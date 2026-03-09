import { NextRequest, NextResponse } from "next/server";
import {
    authenticateRequest,
    verifyOrgAccess,
    apiError,
    serverError,
} from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const META_API = "https://graph.facebook.com/v22.0";

// ═══════════════════════════════════════════════════════════════
//  GET — List WhatsApp message templates from Meta
// ═══════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("templates:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const db = getSupabaseAdmin();
        const { data: org } = await db
            .from("organizations")
            .select("whatsapp_credentials")
            .eq("id", auth.orgId)
            .single();

        if (!org) return apiError("Organizacion no encontrada", 404);

        const creds = (org.whatsapp_credentials || {}) as Record<string, string>;
        if (!creds.business_account_id || !creds.access_token) {
            return apiError("WhatsApp no configurado. Conecta tu cuenta primero.", 400);
        }

        // Fetch templates from Meta
        const metaRes = await fetch(
            `${META_API}/${creds.business_account_id}/message_templates?fields=name,status,category,language,components&limit=100`,
            { headers: { Authorization: `Bearer ${creds.access_token}` } }
        );

        if (!metaRes.ok) {
            const err = await metaRes.json().catch(() => ({}));
            return apiError(
                err?.error?.message || "Error obteniendo templates de Meta",
                metaRes.status
            );
        }

        const metaData = await metaRes.json();
        const templates = (metaData.data || []).map((t: Record<string, unknown>) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            category: t.category,
            language: t.language,
            components: t.components || [],
        }));

        return NextResponse.json({ templates });
    } catch (err) {
        return serverError(err, "templates:GET");
    }
}

// ═══════════════════════════════════════════════════════════════
//  POST — Send a template message to a lead
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("templates:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const body = await req.json();
        const { lead_id, template_name, template_language, parameters } = body;

        if (!lead_id || !template_name) {
            return apiError("lead_id y template_name son requeridos", 400);
        }

        const db = getSupabaseAdmin();

        // Get lead + verify org access
        const { data: lead } = await db
            .from("leads")
            .select("id, phone, organization_id")
            .eq("id", lead_id)
            .single();

        if (!lead || lead.organization_id !== auth.orgId) {
            return apiError("Lead no encontrado", 404);
        }

        // Get org WhatsApp config
        const { data: org } = await db
            .from("organizations")
            .select("whatsapp_credentials")
            .eq("id", auth.orgId)
            .single();

        if (!org) return apiError("Organizacion no encontrada", 404);

        const creds = (org.whatsapp_credentials || {}) as Record<string, string>;
        if (!creds.phone_number_id || !creds.access_token) {
            return apiError("WhatsApp no configurado", 400);
        }

        // Build template payload for Meta
        const templatePayload: Record<string, unknown> = {
            messaging_product: "whatsapp",
            to: lead.phone,
            type: "template",
            template: {
                name: template_name,
                language: { code: template_language || "es" },
            },
        };

        // Add parameters if provided (for templates with variables)
        if (parameters && Array.isArray(parameters) && parameters.length > 0) {
            (templatePayload.template as Record<string, unknown>).components = [
                {
                    type: "body",
                    parameters: parameters.map((p: string) => ({
                        type: "text",
                        text: p,
                    })),
                },
            ];
        }

        // Send via Meta API
        const sendRes = await fetch(
            `${META_API}/${creds.phone_number_id}/messages`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${creds.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(templatePayload),
            }
        );

        const sendData = await sendRes.json();

        if (!sendRes.ok) {
            return apiError(
                sendData?.error?.message || "Error enviando template",
                sendRes.status
            );
        }

        // Save to lead_messages
        await db.from("lead_messages").insert({
            lead_id,
            role: "assistant",
            content: `[Template: ${template_name}]${parameters?.length ? " — " + parameters.join(", ") : ""}`,
        });

        return NextResponse.json({
            success: true,
            message_id: sendData?.messages?.[0]?.id,
        });
    } catch (err) {
        return serverError(err, "templates:POST");
    }
}
