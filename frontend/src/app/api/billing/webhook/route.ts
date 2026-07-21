// ═══════════════════════════════════════════════════════════════
//  💳 STRIPE WEBHOOK — única fuente de verdad de organizations.plan
//
//  - Firma verificada sobre el RAW body (misma técnica que Meta)
//  - Dedupe de reintentos vía webhook_events (PK = event.id)
//  - Público por diseño: la firma ES la autenticación
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getStripe, tierFromPriceId } from "@/lib/stripe";
import { captureError, captureMessage } from "@/lib/monitoring";

async function isDuplicateEvent(eventId: string): Promise<boolean> {
    const db = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db as any)
        .from("webhook_events")
        .insert({ message_id: eventId, organization_id: null });
    if (!error) return false;
    if (error.code === "23505") return true; // ya procesado
    // webhook_events.organization_id es NOT NULL en la migración
    // original → si falla por eso (23502) o tabla ausente, seguimos
    // sin dedupe (Stripe reintenta poco y los updates son idempotentes)
    return false;
}

async function setOrgPlan(
    orgId: string,
    fields: Record<string, unknown>
): Promise<void> {
    const db = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db as any)
        .from("organizations")
        .update(fields)
        .eq("id", orgId);
    if (error) captureError(error, "stripe:set_plan", { orgId, fields });
    else console.log(`💳 [Stripe] Org ${orgId} →`, fields);
}

/** Resuelve la org desde metadata o desde stripe_customer_id. */
async function resolveOrgId(
    metadataOrgId: string | undefined | null,
    customerId: string | undefined | null
): Promise<string | null> {
    if (metadataOrgId) return metadataOrgId;
    if (!customerId) return null;
    const db = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (db as any)
        .from("organizations")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .limit(1)
        .maybeSingle();
    return data?.id ?? null;
}

export async function POST(req: NextRequest) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: "Billing no configurado" }, { status: 503 });
    }

    // ── Verificación de firma sobre el raw body ───────────────
    let event: Stripe.Event;
    try {
        const rawBody = await req.text();
        const signature = req.headers.get("stripe-signature");
        if (!signature) return NextResponse.json({ error: "Sin firma" }, { status: 400 });
        event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
        captureError(err, "stripe:signature");
        return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
    }

    // ── Dedupe de reintentos ──────────────────────────────────
    if (await isDuplicateEvent(event.id)) {
        return NextResponse.json({ received: true, duplicate: true });
    }

    try {
        switch (event.type) {
            // ── Alta: checkout completado ─────────────────────
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                const orgId = session.client_reference_id;
                if (!orgId) break;

                // El tier sale del price de la suscripción creada
                const sub = await getStripe().subscriptions.retrieve(
                    session.subscription as string
                );
                const tier = tierFromPriceId(sub.items.data[0]?.price?.id);
                if (!tier) {
                    captureMessage(`Price desconocido en checkout (org ${orgId})`, "stripe", "warning");
                    break;
                }
                await setOrgPlan(orgId, {
                    plan: tier,
                    plan_status: "active",
                    stripe_customer_id: session.customer as string,
                    stripe_subscription_id: session.subscription as string,
                });

                // 🌙 Starter/Executive: activar Resumen Nocturno 21:00
                // por defecto SOLO si el dueño nunca lo configuró.
                // (read-modify-write puntual post-checkout: aceptable)
                if (tier === "starter" || tier === "executive") {
                    const db = getSupabaseAdmin();
                    const { data: orgRow } = await db
                        .from("organizations")
                        .select("settings")
                        .eq("id", orgId)
                        .single();
                    const s = (orgRow?.settings || {}) as Record<string, unknown>;
                    const ac = (s.appointment_config || {}) as Record<string, unknown>;
                    if (ac.daily_digest_enabled === undefined) {
                        await db.from("organizations").update({
                            settings: {
                                ...s,
                                appointment_config: {
                                    ...ac,
                                    daily_digest_enabled: true,
                                    daily_digest_time: "21:00",
                                },
                            },
                        }).eq("id", orgId);
                        console.log(`🌙 [Stripe] Resumen Nocturno 21:00 activado por defecto (org ${orgId})`);
                    }
                }
                break;
            }

            // ── Cambios: upgrade/downgrade/estado ─────────────
            case "customer.subscription.updated": {
                const sub = event.data.object as Stripe.Subscription;
                const orgId = await resolveOrgId(
                    sub.metadata?.org_id,
                    sub.customer as string
                );
                if (!orgId) break;

                const tier = tierFromPriceId(sub.items.data[0]?.price?.id);
                const status =
                    sub.status === "past_due" || sub.status === "unpaid" ? "past_due"
                    : sub.status === "canceled" ? "canceled"
                    : sub.status === "trialing" ? "trialing"
                    : "active";

                await setOrgPlan(orgId, {
                    ...(tier ? { plan: tier } : {}),
                    plan_status: status,
                    stripe_subscription_id: sub.id,
                });
                break;
            }

            // ── Baja: suscripción eliminada → free ────────────
            case "customer.subscription.deleted": {
                const sub = event.data.object as Stripe.Subscription;
                const orgId = await resolveOrgId(
                    sub.metadata?.org_id,
                    sub.customer as string
                );
                if (!orgId) break;
                await setOrgPlan(orgId, {
                    plan: "free",
                    plan_status: "canceled",
                    stripe_subscription_id: null,
                });
                break;
            }

            // ── Pago fallido → past_due + alerta in-app ───────
            case "invoice.payment_failed": {
                const invoice = event.data.object as Stripe.Invoice;
                const orgId = await resolveOrgId(null, invoice.customer as string);
                if (!orgId) break;

                await setOrgPlan(orgId, { plan_status: "past_due" });

                const db = getSupabaseAdmin();
                await db.from("notifications").insert({
                    tenant_id: orgId,
                    type: "billing",
                    message:
                        "⚠️ El pago de tu suscripción Xelera falló. Actualiza tu método de pago en Configuración → Plan para no perder las funciones de tu plan.",
                });
                break;
            }

            default:
                break; // eventos no manejados → 200 igual
        }

        return NextResponse.json({ received: true });
    } catch (err) {
        captureError(err, "stripe:webhook", { eventType: event.type });
        return NextResponse.json({ error: "Error procesando evento" }, { status: 500 });
    }
}
