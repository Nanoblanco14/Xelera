// ═══════════════════════════════════════════════════════════════
//  Next.js Instrumentation — inicializa Sentry en el servidor
//  Solo se activa si SENTRY_DSN está definido; sin DSN es no-op.
// ═══════════════════════════════════════════════════════════════

import * as Sentry from "@sentry/nextjs";

export async function register() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) return; // sin DSN → observabilidad desactivada, cero overhead

    Sentry.init({
        dsn,
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
        // Muestreo conservador de performance; los errores van al 100%
        tracesSampleRate: 0.1,
        // No enviar PII por defecto (teléfonos de leads, etc.)
        sendDefaultPii: false,
    });

    console.log("[Sentry] Observabilidad server-side activada");
}

// Captura errores no manejados de React Server Components / rutas
export const onRequestError = Sentry.captureRequestError;
