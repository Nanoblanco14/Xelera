// ═══════════════════════════════════════════════════════════════
//  🛰️ MONITORING — wrapper fino sobre Sentry (server-side)
//
//  Uso: captureError(err, "webhook:process", { orgId }) en cada
//  catch crítico. Si SENTRY_DSN no está configurado, degrada a
//  console.error sin costo — el código de negocio no cambia.
// ═══════════════════════════════════════════════════════════════

import * as Sentry from "@sentry/nextjs";

const SENTRY_ENABLED = !!(
    process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
);

/**
 * Reporta una excepción a Sentry (si está configurado) y siempre
 * la deja en los logs con su contexto.
 */
export function captureError(
    err: unknown,
    context: string,
    extra?: Record<string, unknown>
): void {
    console.error(`[${context}]`, err, extra ?? "");

    if (!SENTRY_ENABLED) return;

    try {
        Sentry.captureException(err, {
            tags: { context },
            extra,
        });
    } catch {
        // El monitoreo nunca debe romper el flujo principal
    }
}

/**
 * Mensaje de nivel warning/info para eventos operativos importantes
 * que no son excepciones (p. ej. token de Meta vencido).
 */
export function captureMessage(
    message: string,
    context: string,
    level: "warning" | "info" = "warning",
    extra?: Record<string, unknown>
): void {
    if (level === "warning") console.warn(`[${context}] ${message}`, extra ?? "");
    else console.log(`[${context}] ${message}`, extra ?? "");

    if (!SENTRY_ENABLED) return;

    try {
        Sentry.captureMessage(message, { level, tags: { context }, extra });
    } catch {
        /* no-op */
    }
}
