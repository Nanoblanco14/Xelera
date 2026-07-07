// ── POST /api/billing/portal ────────────────────────────────
// Customer Portal de Stripe: upgrade/downgrade, cancelar, tarjeta,
// facturas — todo gestionado por Stripe, cero UI propia.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, apiError, serverError } from "@/lib/api-auth";
import { getStripe, stripeConfigured } from "@/lib/stripe";

export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("billing:portal");
        if ("error" in result) return result.error;
        const { auth } = result;

        if (!stripeConfigured()) {
            return apiError("Billing no configurado", 503, "BILLING_DISABLED");
        }

        const db = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: org } = await (db as any)
            .from("organizations")
            .select("stripe_customer_id")
            .eq("id", auth.orgId)
            .single();

        if (!org?.stripe_customer_id) {
            return apiError("La organización no tiene suscripción activa", 404, "NO_CUSTOMER");
        }

        const origin =
            req.headers.get("origin") ||
            `https://${req.headers.get("host") || "localhost:3000"}`;

        const session = await getStripe().billingPortal.sessions.create({
            customer: org.stripe_customer_id,
            return_url: `${origin}/dashboard/settings`,
        });

        return NextResponse.json({ data: { url: session.url } });
    } catch (err) {
        return serverError(err, "billing:portal");
    }
}
