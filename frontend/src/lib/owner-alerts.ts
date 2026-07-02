// ═══════════════════════════════════════════════════════════════
//  🔔 OWNER ALERTS — Avisos por WhatsApp al dueño del negocio
//
//  Complementa las notificaciones in-app: los dueños de pymes no
//  viven dentro del dashboard, pero sí dentro de WhatsApp. Usa el
//  owner_phone configurado en appointment_config (Settings).
// ═══════════════════════════════════════════════════════════════

import { getAppointmentConfig } from "@/lib/appointments";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export interface HotLeadAlertParams {
    orgId: string;
    leadName: string;
    leadPhone: string;
    /** Resumen corto del motivo (viene del resumen_conversacion de la IA) */
    reason?: string;
}

/**
 * Envía una alerta de "lead caliente" al WhatsApp del dueño cuando
 * un lead pide atención humana. Fire-and-forget: nunca lanza — el
 * webhook no debe fallar por un aviso.
 */
export async function notifyOwnerHotLead(params: HotLeadAlertParams): Promise<void> {
    const { orgId, leadName, leadPhone, reason } = params;

    try {
        const config = await getAppointmentConfig(orgId);

        if (!config.hot_lead_alerts_enabled) return;
        if (!config.owner_phone) return; // sin teléfono configurado, nada que hacer

        // Nunca auto-alertarse: si el lead ES el dueño (pruebas), omitir
        const normalize = (p: string) => p.replace(/\D/g, "");
        if (normalize(config.owner_phone) === normalize(leadPhone)) return;

        const displayName =
            leadName && !/^(lead whatsapp|cliente|lead)$/i.test(leadName.trim())
                ? leadName
                : `Un cliente (+${leadPhone})`;

        const reasonLine = reason
            ? `\n📝 Contexto: ${reason.slice(0, 200)}`
            : "";

        const message =
            `🔴 *Lead caliente — requiere tu atención*\n\n` +
            `${displayName} pidió hablar con una persona.\n` +
            `📱 Teléfono: +${leadPhone}${reasonLine}\n\n` +
            `Responde desde el Inbox de Xelera (el bot quedó en pausa para este chat).`;

        const result = await sendWhatsAppMessage(orgId, config.owner_phone, message);
        if (!result.success) {
            console.error(`[OwnerAlert] No se pudo avisar al dueño (org ${orgId}):`, result.error);
        } else {
            console.log(`[OwnerAlert] Alerta de lead caliente enviada al dueño (org ${orgId})`);
        }
    } catch (err) {
        console.error(`[OwnerAlert] Error enviando alerta (org ${orgId}):`, err);
    }
}
