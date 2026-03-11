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
//  POST — WhatsApp Embedded Signup
//  Exchanges the FB.login() auth code for a token, then runs
//  the same verify / register / subscribe / save pipeline as
//  the manual connect route.
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("whatsapp:embedded-signup:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const body = await req.json();
        const { org_id, code, phone_number_id, waba_id } = body;

        // Validate required fields
        if (!org_id) return apiError("org_id es requerido", 400);
        if (!code) return apiError("code es requerido", 400);
        if (!phone_number_id) return apiError("phone_number_id es requerido", 400);
        if (!waba_id) return apiError("waba_id es requerido", 400);

        const accessError = verifyOrgAccess(auth, org_id);
        if (accessError) return accessError;

        const stepsCompleted: string[] = [];

        // ── Step 1: Exchange code for access token ──────────────
        const metaAppId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;
        const metaAppSecret = process.env.META_APP_SECRET;

        if (!metaAppId || !metaAppSecret) {
            return NextResponse.json(
                {
                    success: false,
                    step: "exchange_code",
                    error: "Configuracion del servidor incompleta: META_APP_ID o META_APP_SECRET no definidos.",
                    steps_completed: stepsCompleted,
                },
                { status: 500 }
            );
        }

        let access_token: string;
        let expires_in: number;

        try {
            const tokenUrl = new URL(`${META_API}/oauth/access_token`);
            tokenUrl.searchParams.set("client_id", metaAppId);
            tokenUrl.searchParams.set("client_secret", metaAppSecret);
            tokenUrl.searchParams.set("code", code);

            const tokenRes = await fetch(tokenUrl.toString());

            if (!tokenRes.ok) {
                const errData = await tokenRes.json().catch(() => ({}));
                const errMsg =
                    errData?.error?.message ||
                    "Error intercambiando el codigo de autorizacion por un token.";
                return NextResponse.json(
                    {
                        success: false,
                        step: "exchange_code",
                        error: errMsg,
                        steps_completed: stepsCompleted,
                    },
                    { status: 400 }
                );
            }

            const tokenData = await tokenRes.json();
            access_token = tokenData.access_token;
            expires_in = tokenData.expires_in || 0;

            if (!access_token) {
                return NextResponse.json(
                    {
                        success: false,
                        step: "exchange_code",
                        error: "Meta no devolvio un access_token valido.",
                        steps_completed: stepsCompleted,
                    },
                    { status: 502 }
                );
            }

            stepsCompleted.push("exchange_code");
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    step: "exchange_code",
                    error: "Error de conexion al intercambiar el codigo con Meta.",
                    steps_completed: stepsCompleted,
                },
                { status: 502 }
            );
        }

        // ── Step 2: Verify Token ────────────────────────────────
        let phoneInfo: {
            display_phone: string;
            verified_name: string;
            quality_rating: string;
        };
        try {
            const verifyRes = await fetch(
                `${META_API}/${phone_number_id}?fields=verified_name,quality_rating,display_phone_number,code_verification_status`,
                { headers: { Authorization: `Bearer ${access_token}` } }
            );

            if (!verifyRes.ok) {
                const errData = await verifyRes.json().catch(() => ({}));
                const errMsg =
                    errData?.error?.message ||
                    "Token invalido o Phone Number ID incorrecto";
                return NextResponse.json(
                    {
                        success: false,
                        step: "verify_token",
                        error: errMsg,
                        steps_completed: stepsCompleted,
                    },
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
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    step: "verify_token",
                    error: "Error de conexion con Meta. Intenta de nuevo.",
                    steps_completed: stepsCompleted,
                },
                { status: 502 }
            );
        }

        // ── Step 3: Register Phone Number ───────────────────────
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
                            error:
                                errData?.error?.message ||
                                "Error registrando el numero de telefono",
                            steps_completed: stepsCompleted,
                        },
                        { status: 400 }
                    );
                }
            }
            stepsCompleted.push("register_phone");
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    step: "register_phone",
                    error: "Error de conexion al registrar el numero.",
                    steps_completed: stepsCompleted,
                },
                { status: 502 }
            );
        }

        // ── Step 4: Subscribe App to Webhooks ───────────────────
        try {
            const subscribeRes = await fetch(
                `${META_API}/${waba_id}/subscribed_apps`,
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
                        error:
                            errData?.error?.message ||
                            "Error suscribiendo webhooks. Verifica el WABA ID.",
                        steps_completed: stepsCompleted,
                    },
                    { status: 400 }
                );
            }
            stepsCompleted.push("subscribe_webhooks");
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    step: "subscribe_webhooks",
                    error: "Error de conexion al suscribir webhooks.",
                    steps_completed: stepsCompleted,
                },
                { status: 502 }
            );
        }

        // ── Step 5: Save to Supabase ────────────────────────────
        const verifyToken = `miagente_vt_${crypto.randomUUID().split("-")[0]}`;
        const webhookUrl = buildWebhookUrl(req, org_id);

        try {
            const db = getSupabaseAdmin();
            const tokenExpiresAt = expires_in
                ? new Date(Date.now() + expires_in * 1000).toISOString()
                : null;

            const { error: dbError } = await db
                .from("organizations")
                .update({
                    whatsapp_provider: "meta",
                    whatsapp_credentials: {
                        access_token,
                        phone_number_id,
                        business_account_id: waba_id,
                        verify_token: verifyToken,
                        connected_at: new Date().toISOString(),
                        phone_display: phoneInfo.display_phone,
                        phone_verified_name: phoneInfo.verified_name,
                        phone_quality_rating: phoneInfo.quality_rating,
                        token_expires_at: tokenExpiresAt,
                        signup_method: "embedded_signup",
                    },
                })
                .eq("id", org_id);

            if (dbError) {
                return NextResponse.json(
                    {
                        success: false,
                        step: "save_credentials",
                        error: "Error guardando configuracion: " + dbError.message,
                        steps_completed: stepsCompleted,
                    },
                    { status: 500 }
                );
            }
            stepsCompleted.push("save_credentials");
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    step: "save_credentials",
                    error: "Error guardando configuracion.",
                    steps_completed: stepsCompleted,
                },
                { status: 500 }
            );
        }

        // ── Success ─────────────────────────────────────────────
        return NextResponse.json({
            success: true,
            steps_completed: stepsCompleted,
            phone_info: phoneInfo,
            webhook_url: webhookUrl,
            verify_token: verifyToken,
        });
    } catch (err) {
        return serverError(err, "whatsapp:embedded-signup:POST");
    }
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════
function buildWebhookUrl(req: NextRequest, orgId: string): string {
    const host =
        req.headers.get("x-forwarded-host") ||
        req.headers.get("host") ||
        "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    return `${protocol}://${host}/api/webhook/${orgId}`;
}
