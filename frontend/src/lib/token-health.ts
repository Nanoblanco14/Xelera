// ═══════════════════════════════════════════════════════════════
//  🩺 TOKEN HEALTH — validación proactiva de tokens de Meta
//
//  El outbox detecta un token roto cuando el PRIMER mensaje falla;
//  este job lo detecta ANTES de que falle mensaje alguno:
//
//    1. Cadencia diaria por org (marcador meta_token_checked_at en
//       settings — independiente de a qué hora corra el cron)
//    2. GET /debug_token → is_valid + expires_at (los tokens
//       temporales de Meta duran 24h; los de system user, ~60 días
//       o permanentes con expires_at = 0)
//    3. Fallback: ping al phone_number_id (algunos tipos de token
//       no pueden inspeccionarse a sí mismos)
//    4. Inválido o vence en <72h → alerta in-app centralizada
//       (deduplicada 20h, tipo 'token_health') + Sentry
//
//  El dueño se anticipa: reconecta WhatsApp en Configuración antes
//  de perder un solo lead.
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from "@/lib/supabase";
import { captureError, captureMessage } from "@/lib/monitoring";

const META_API = "https://graph.facebook.com/v22.0";
const CHECK_EVERY_MS = 20 * 3600 * 1000;        // cadencia diaria (holgura 20h)
const EXPIRY_WARNING_MS = 72 * 3600 * 1000;     // avisar si vence en <72h
const ALERT_DEDUPE_MS = 20 * 3600 * 1000;       // máx. 1 alerta al día por org
const FETCH_TIMEOUT_MS = 10_000;

type TokenVerdict =
    | { state: "valid"; expiresAt: number | null }      // expiresAt epoch s (null = no expira)
    | { state: "expiring"; expiresAt: number }
    | { state: "invalid"; detail: string }
    | { state: "unknown" };                             // no se pudo determinar — no alertar

// ── Inspección del token contra Graph API ───────────────────

async function inspectToken(
    accessToken: string,
    phoneNumberId?: string
): Promise<TokenVerdict> {
    // ── 1. debug_token: el veredicto más rico ──
    try {
        const res = await fetch(
            `${META_API}/debug_token?input_token=${encodeURIComponent(accessToken)}` +
            `&access_token=${encodeURIComponent(accessToken)}`,
            { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
        );

        if (res.ok) {
            const body = await res.json().catch(() => null);
            const data = body?.data;
            if (data) {
                if (data.is_valid === false) {
                    return {
                        state: "invalid",
                        detail: data.error?.message || "Token marcado como inválido por Meta",
                    };
                }
                const expiresAt: number = Number(data.expires_at) || 0;
                if (expiresAt > 0) {
                    const msLeft = expiresAt * 1000 - Date.now();
                    if (msLeft <= 0) {
                        return { state: "invalid", detail: "Token expirado" };
                    }
                    if (msLeft < EXPIRY_WARNING_MS) {
                        return { state: "expiring", expiresAt };
                    }
                    return { state: "valid", expiresAt };
                }
                return { state: "valid", expiresAt: null }; // 0 = no expira
            }
        } else if (res.status === 401 || res.status === 400) {
            // Un token muerto no puede ni inspeccionarse a sí mismo,
            // pero 400 también ocurre con tipos no inspeccionables →
            // confirmar con el ping antes de sentenciar
            const pingVerdict = await pingPhoneNumber(accessToken, phoneNumberId);
            if (pingVerdict) return pingVerdict;
            return { state: "invalid", detail: `debug_token respondió ${res.status}` };
        }
    } catch (err) {
        // Red caída ≠ token roto: no alertar por un timeout nuestro
        captureError(err, "token_health:debug_token");
    }

    // ── 2. Fallback: ping real al recurso ──
    const pingVerdict = await pingPhoneNumber(accessToken, phoneNumberId);
    return pingVerdict ?? { state: "unknown" };
}

async function pingPhoneNumber(
    accessToken: string,
    phoneNumberId?: string
): Promise<TokenVerdict | null> {
    if (!phoneNumberId) return null;
    try {
        const res = await fetch(`${META_API}/${phoneNumberId}?fields=id`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (res.ok) return { state: "valid", expiresAt: null };
        if (res.status === 401 || res.status === 403) {
            const body = await res.json().catch(() => ({}));
            return {
                state: "invalid",
                detail: body?.error?.message || `Graph API respondió ${res.status}`,
            };
        }
        return { state: "unknown" }; // 5xx / rate limit → no concluyente
    } catch {
        return { state: "unknown" }; // problema de red → no alertar
    }
}

// ── Alerta in-app centralizada (deduplicada) ─────────────────

async function alertOrg(
    orgId: string,
    orgName: string,
    verdict: Extract<TokenVerdict, { state: "invalid" | "expiring" }>
): Promise<boolean> {
    const db = getSupabaseAdmin();

    // Dedupe: máx. una alerta de salud de token al día por org
    const since = new Date(Date.now() - ALERT_DEDUPE_MS).toISOString();
    const { data: recent } = await db
        .from("notifications")
        .select("id")
        .eq("tenant_id", orgId)
        .eq("type", "token_health")
        .gte("created_at", since)
        .limit(1);

    if (recent && recent.length > 0) return false;

    let message: string;
    if (verdict.state === "invalid") {
        message =
            "🚫 Tu conexión de WhatsApp dejó de funcionar: el token de Meta es inválido o fue revocado. " +
            "Reconecta WhatsApp en Configuración para no perder mensajes.";
    } else {
        const hoursLeft = Math.max(1, Math.round((verdict.expiresAt * 1000 - Date.now()) / 3600_000));
        message =
            `⏳ Tu token de WhatsApp vence en ~${hoursLeft} hora${hoursLeft === 1 ? "" : "s"}. ` +
            "Reconecta WhatsApp en Configuración antes de que caduque para no perder ningún lead.";
    }

    await db.from("notifications").insert({
        tenant_id: orgId,
        type: "token_health",
        message,
    });

    captureMessage(
        `Token de Meta ${verdict.state === "invalid" ? "INVÁLIDO" : "por vencer"} — org ${orgName} (${orgId})`,
        "token_health",
        "warning",
        { orgId, verdict }
    );

    console.warn(`🩺 [TokenHealth] Alerta creada para ${orgName}: token ${verdict.state}`);
    return true;
}

// ═══════════════════════════════════════════════════════════════
//  JOB DEL CRON
// ═══════════════════════════════════════════════════════════════

export interface TokenHealthResult {
    orgsChecked: number;
    alertsCreated: number;
}

/**
 * Valida el access_token de cada org con provider Meta. Cadencia
 * diaria por org vía settings.meta_token_checked_at — funciona
 * igual con cron horario (Pro) o diario (Hobby/externo).
 */
export async function checkMetaTokenHealth(): Promise<TokenHealthResult> {
    const db = getSupabaseAdmin();
    const result: TokenHealthResult = { orgsChecked: 0, alertsCreated: 0 };

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orgs, error } = await (db as any)
            .from("organizations")
            .select("id, name, whatsapp_credentials, meta_token_checked_at")
            .eq("whatsapp_provider", "meta");

        if (error || !orgs) return result;

        const now = Date.now();

        for (const org of orgs) {
            try {
                const creds = (org.whatsapp_credentials || {}) as Record<string, string>;
                if (!creds.access_token) continue;

                // ── Cadencia diaria por org (columna propia, sin
                // read-modify-write del JSONB settings → cero races) ──
                const lastChecked = org.meta_token_checked_at
                    ? new Date(org.meta_token_checked_at as string).getTime()
                    : 0;
                if (now - lastChecked < CHECK_EVERY_MS) continue;

                // ── Inspeccionar ──
                const verdict = await inspectToken(creds.access_token, creds.phone_number_id);
                result.orgsChecked++;

                // Marcador atómico (UPDATE de columna plana)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (db as any)
                    .from("organizations")
                    .update({ meta_token_checked_at: new Date().toISOString() })
                    .eq("id", org.id);

                if (verdict.state === "invalid" || verdict.state === "expiring") {
                    const alerted = await alertOrg(org.id, org.name, verdict);
                    if (alerted) result.alertsCreated++;
                } else if (verdict.state === "valid") {
                    console.log(
                        `🩺 [TokenHealth] ${org.name}: token OK` +
                        (verdict.expiresAt
                            ? ` (vence ${new Date(verdict.expiresAt * 1000).toISOString().slice(0, 10)})`
                            : " (sin expiración)")
                    );
                }
                // "unknown" → silencio: mejor no alertar por falsos positivos
            } catch (err) {
                captureError(err, "token_health:org", { orgId: org.id });
            }
        }
    } catch (err) {
        captureError(err, "token_health:job");
    }

    return result;
}
