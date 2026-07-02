// ═══════════════════════════════════════════════════════════════
//  Sentry — instrumentación del navegador (errores de UI)
//  Solo se activa si NEXT_PUBLIC_SENTRY_DSN está definido.
// ═══════════════════════════════════════════════════════════════

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: 0.05,
        // Sin session replay por ahora (peso + privacidad)
        sendDefaultPii: false,
    });
}

// Instrumenta las navegaciones del App Router
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
