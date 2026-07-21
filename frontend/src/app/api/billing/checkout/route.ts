// ── POST /api/billing/checkout ──────────────────────────────
// Crea una sesión de Stripe Checkout (hosted) para suscribirse a
// pro/business. orgId viaja como client_reference_id — el webhook
// lo usa para activar el plan.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, apiError, serverError } from "@/lib/api-auth";
import { getStripe, stripeConfigured, PRICE_MAP } from "@/lib/stripe";
import type { PlanTier } from "@/lib/plan-limits";

export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("billing:checkout");
        if ("error" in result) return result.error;
        const { auth } = result;

        if (!stripeConfigured()) {
            return apiError("Billing no configurado (STRIPE_SECRET_KEY)", 503, "BILLING_DISABLED");
        }

        const { tier } = (await req.json().catch(() => ({}))) as { tier?: string };
        const VALID_TIERS = ["starter", "pro", "business", "executive"];
        if (!tier || !VALID_TIERS.includes(tier)) {
            return apiError("tier inválido", 400, "INVALID_TIER");
        }
        const priceId = PRICE_MAP[tier as Exclude<PlanTier, "free">];
        if (!priceId) {
            return apiError(`STRIPE_PRICE_${tier.toUpperCase()} no configurado`, 503, "PRICE_MISSING");
        }

        // Reutilizar customer si la org ya pagó antes
        const db = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: org } = await (db as any)
            .from("organizations")
            .select("stripe_customer_id, name")
            .eq("id", auth.orgId)
            .single();

        const origin =
            req.headers.get("origin") ||
            `https://${req.headers.get("host") || "localhost:3000"}`;

        const session = await getStripe().checkout.sessions.create({
            mode: "subscription",
            client_reference_id: auth.orgId,
            // Sin customer previo, Stripe pide el email en el checkout
            ...(org?.stripe_customer_id ? { customer: org.stripe_customer_id } : {}),
            line_items: [{ price: priceId, quantity: 1 }],
            allow_promotion_codes: true,
            subscription_data: { metadata: { org_id: auth.orgId } },
            success_url: `${origin}/dashboard/settings?billing=success`,
            cancel_url: `${origin}/dashboard/settings?billing=cancelled`,
        });

        return NextResponse.json({ data: { url: session.url } });
    } catch (err) {
        return serverError(err, "billing:checkout");
    }
}
