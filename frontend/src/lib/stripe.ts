// ═══════════════════════════════════════════════════════════════
//  💳 STRIPE — singleton + mapeo tier ↔ price
//  Checkout hosted + Customer Portal: Stripe gestiona tarjetas,
//  upgrades, cancelaciones y facturas. Sin PCI en nuestro lado.
// ═══════════════════════════════════════════════════════════════

import Stripe from "stripe";
import type { PlanTier } from "@/lib/plan-limits";

let client: Stripe | null = null;

export function getStripe(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY no está configurado");
    if (!client) client = new Stripe(key);
    return client;
}

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

// tier → price id (crear los prices en el dashboard de Stripe)
export const PRICE_MAP: Record<Exclude<PlanTier, "free">, string | undefined> = {
    pro: process.env.STRIPE_PRICE_PRO,
    business: process.env.STRIPE_PRICE_BUSINESS,
};

/** price id → tier (para el webhook) */
export function tierFromPriceId(priceId: string | undefined): PlanTier | null {
    if (!priceId) return null;
    if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
    if (priceId === process.env.STRIPE_PRICE_BUSINESS) return "business";
    return null;
}
