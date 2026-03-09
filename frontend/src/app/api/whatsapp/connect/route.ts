import { NextRequest, NextResponse } from "next/server";
import {
    authenticateRequest,
    verifyOrgAccess,
    apiError,
    serverError,
} from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

// ═══════════════════════════════════════════════════════════════
//  Meta Graph API base
// ═══════════════════════════════════════════════════════════════
const META_API = "https://graph.facebook.com/v22.0";

// ═══════════════════════════════════════════════════════════════
//  GET — Check WhatsApp connection status
// ═══════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("whatsapp:connect:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id es requerido", 400);

        const accessError = verifyOrgAccess(auth, orgId);
        if (accessError) return accessError;

        const db = getSupabaseAdmin();
        const { data: org } = await db
            .from("organizations")
            .select("whatsapp_provider, whatsapp_credentials")
            .eq("id", orgId)
            .single();

        if (!org) return apiError("Organizacion no encontrada", 404);

        const creds = (org.whatsapp_credentials || {}) as Record<string, string>;
        const hasCredentials = !!(creds.access_token && creds.phone_number_id);

        // Base response for disconnected state
        if (!hasCredentials) {
            return NextResponse.json({
                connected: false,
                phone_number_id: null,
                display_phone: null,
                verified_name: null,
                quality_rating: null,
                connected_at: null,
                webhook_url: buildWebhookUrl(req, orgId),
                verify_token: creds.verify_token || null,
            });
        }

        // Live check against Meta API
        let liveInfo: Record<string, string | null> = {
            display_phone: creds.phone_display || null,
            verified_name: creds.phone_verified_name || null,
            quality_rating: creds.phone_quality_rating || null,
        };

        try {
            const metaRes = await fetch(
                `${META_API}/${creds.phone_number_id}?fields=verified_name,quality_rating,display_phone_number`,
                { headers: { Authorization: `Bearer ${creds.access_token}` } }
            );
            if (metaRes.ok) {
                const metaData = await metaRes.json();
                liveInfo = {
                    display_phone: metaData.display_phone_number || liveInfo.display_phone,
                    verified_name: metaData.verified_name || liveInfo.verified_name,
                    quality_rating: metaData.quality_rating || liveInfo.quality_rating,
                };
            }
        } catch {
            // Non-blocking: use cached info
        }

        return NextResponse.json({
            connected: true,
            phone_number_id: creds.phone_number_id,
            display_phone: liveInfo.display_phone,
            verified_name: liveInfo.verified_name,
            quality_rating: liveInfo.quality_rating,
            connected_at: creds.connected_at || null,
            webhook_url: buildWebhookUrl(req, orgId),
            verify_token: creds.verify_token || null,
        });
    } catch (err) {
        return serverError(err, "whatsapp:connect:GET");
    }
}

// ═══════════════════════════════════════════════════════════════
//  POST — Connect WhatsApp (verify + register + subscribe + save)
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("whatsapp:connect:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const body = await req.json();
        const { org_id, access_token, phone_number_id, business_account_id } = body;

        // Validate required fields
        if (!org_id) return apiError("org_id es requerido", 400);
        if (!access_token) return apiError("access_token es requerido", 400);
        if (!phone_number_id) return apiError("phone_number_id es requerido", 400);
        if (!business_account_id) return apiError("business_account_id es requerido", 400);

        const accessError = verifyOrgAccess(auth, org_id);
        if (accessError) return accessError;

        const stepsCompleted: string[] = [];

        // ── Step 1: Verify Token ──────────────────────────────
        let phoneInfo: { display_phone: string; verified_name: string; quality_rating: string };
        try {
            const verifyRes = await fetch(
                `${META_API}/${phone_number_id}?fields=verified_name,quality_rating,display_phone_number,code_verification_status`,
                { headers: { Authorization: `Bearer ${access_token}` } }
            );

            if (!verifyRes.ok) {
                const errData = await verifyRes.json().catch(() => ({}));
                const errMsg = errData?.error?.message || "Token invalido o Phone Number ID incorrecto";
                return NextResponse.json(
                    { success: false, step: "verify_token", error: errMsg, steps_completed: stepsCompleted },
                    { status: 400 }
                );
            }

            const metaData = await verifyRes.json();
            phoneInfo = {
                display_phone: metaData.display_phone_number || "",
                verified_name: metaData.verified_name || "",
                quality_rating: metaData.quality_rating || "UNKNOWN",
            };
            stepsCompleted.push("verify_token");
        } catch (err) {
            return NextResponse.json(
                { success: false, step: "verify_token", error: "Error de conexion con Meta. Intenta de nuevo.", steps_completed: stepsCompleted },
                { status: 502 }
            );
        }

        // ── Step 2: Register Phone Number ─────────────────────
        try {
            const registerRes = await fetch(
                `${META_API}/${phone_number_id}/register`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        messaging_product: "whatsapp",
                        pin: "123456",
                    }),
                }
            );

            if (!registerRes.ok) {
                const errData = await registerRes.json().catch(() => ({}));
                const errCode = errData?.error?.code;
                const errSubcode = errData?.error?.error_subcode;

                // Already registered = OK (treat as success)
                const isAlreadyRegistered =
                    errCode === 100 ||
                    errSubcode === 2388090 ||
                    errData?.error?.message?.includes("already registered");

                if (!isAlreadyRegistered) {
                    return NextResponse.json(
                        {
                            success: false,
                            step: "register_phone",
                            error: errData?.error?.message || "Error registrando el numero de telefono",
                            steps_completed: stepsCompleted,
                        },
                        { status: 400 }
                    );
                }
            }
            stepsCompleted.push("register_phone");
        } catch {
            return NextResponse.json(
                { success: false, step: "register_phone", error: "Error de conexion al registrar el numero.", steps_completed: stepsCompleted },
                { status: 502 }
            );
        }

        // ── Step 3: Subscribe App to Webhooks ─────────────────
        try {
            const subscribeRes = await fetch(
                `${META_API}/${business_account_id}/subscribed_apps`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!subscribeRes.ok) {
                const errData = await subscribeRes.json().catch(() => ({}));
                return NextResponse.json(
                    {
                        success: false,
                        step: "subscribe_webhooks",
                        error: errData?.error?.message || "Error suscribiendo webhooks. Verifica el Business Account ID.",
                        steps_completed: stepsCompleted,
                    },
                    { status: 400 }
                );
            }
            stepsCompleted.push("subscribe_webhooks");
        } catch {
            return NextResponse.json(
                { success: false, step: "subscribe_webhooks", error: "Error de conexion al suscribir webhooks.", steps_completed: stepsCompleted },
                { status: 502 }
            );
        }

        // ── Step 4: Save to Supabase ──────────────────────────
        const verifyToken = `miagente_vt_${crypto.randomUUID().split("-")[0]}`;
        const webhookUrl = buildWebhookUrl(req, org_id);

        try {
            const db = getSupabaseAdmin();
            const { error: dbError } = await db
                .from("organizations")
                .update({
                    whatsapp_provider: "meta",
                    whatsapp_credentials: {
                        access_token,
                        phone_number_id,
                        business_account_id,
                        verify_token: verifyToken,
                        connected_at: new Date().toISOString(),
                        phone_display: phoneInfo.display_phone,
                        phone_verified_name: phoneInfo.verified_name,
                        phone_quality_rating: phoneInfo.quality_rating,
                    },
                })
                .eq("id", org_id);

            if (dbError) {
                return NextResponse.json(
                    { success: false, step: "save_credentials", error: "Error guardando configuracion: " + dbError.message, steps_completed: stepsCompleted },
                    { status: 500 }
                );
            }
            stepsCompleted.push("save_credentials");
        } catch {
            return NextResponse.json(
                { success: false, step: "save_credentials", error: "Error guardando configuracion.", steps_completed: stepsCompleted },
                { status: 500 }
            );
        }

        // ── Success ───────────────────────────────────────────
        return NextResponse.json({
            success: true,
            steps_completed: stepsCompleted,
            phone_info: phoneInfo,
            webhook_url: webhookUrl,
            verify_token: verifyToken,
        });
    } catch (err) {
        return serverError(err, "whatsapp:connect:POST");
    }
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════
function buildWebhookUrl(req: NextRequest, orgId: string): string {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    return `${protocol}://${host}/api/webhook/${orgId}`;
}
