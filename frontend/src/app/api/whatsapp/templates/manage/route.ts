import { NextRequest, NextResponse } from "next/server";
import {
    authenticateRequest,
    apiError,
    serverError,
} from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const META_API = "https://graph.facebook.com/v22.0";

// ═══════════════════════════════════════════════════════════════
//  POST — Create a new WhatsApp template and submit to Meta
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("templates-manage:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const body = await req.json();
        const {
            name,
            category,
            language,
            header_text,
            body_text,
            footer_text,
            buttons,
        } = body;

        // Validate required fields
        if (!name || !category || !body_text) {
            return apiError("Nombre, categoría y cuerpo del mensaje son requeridos", 400);
        }

        // Validate name format (lowercase, underscores only)
        const cleanName = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
        if (!cleanName || cleanName.length < 2) {
            return apiError("El nombre del template debe tener al menos 2 caracteres (solo letras, números y guión bajo)", 400);
        }

        // Validate category
        if (!["MARKETING", "UTILITY"].includes(category)) {
            return apiError("La categoría debe ser MARKETING o UTILITY", 400);
        }

        // Get org WhatsApp credentials
        const db = getSupabaseAdmin();
        const { data: org } = await db
            .from("organizations")
            .select("whatsapp_credentials")
            .eq("id", auth.orgId)
            .single();

        if (!org) return apiError("Organización no encontrada", 404);

        const creds = (org.whatsapp_credentials || {}) as Record<string, string>;
        if (!creds.business_account_id || !creds.access_token) {
            return apiError("WhatsApp no configurado. Conecta tu cuenta primero.", 400);
        }

        // Build components array for Meta API
        const components: Record<string, unknown>[] = [];

        // Header (optional)
        if (header_text?.trim()) {
            components.push({
                type: "HEADER",
                format: "TEXT",
                text: header_text.trim(),
            });
        }

        // Body (required)
        components.push({
            type: "BODY",
            text: body_text.trim(),
        });

        // Footer (optional)
        if (footer_text?.trim()) {
            components.push({
                type: "FOOTER",
                text: footer_text.trim(),
            });
        }

        // Buttons (optional)
        if (buttons && Array.isArray(buttons) && buttons.length > 0) {
            const validButtons = buttons
                .filter((b: { type?: string; text?: string; url?: string }) => b.text?.trim())
                .map((b: { type?: string; text?: string; url?: string }) => {
                    if (b.type === "URL" && b.url?.trim()) {
                        return { type: "URL", text: b.text!.trim(), url: b.url.trim() };
                    }
                    return { type: "QUICK_REPLY", text: b.text!.trim() };
                });

            if (validButtons.length > 0) {
                components.push({
                    type: "BUTTONS",
                    buttons: validButtons,
                });
            }
        }

        // Submit to Meta API
        const metaPayload = {
            name: cleanName,
            language: language || "es",
            category,
            components,
        };

        const metaRes = await fetch(
            `${META_API}/${creds.business_account_id}/message_templates`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${creds.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(metaPayload),
            }
        );

        const metaData = await metaRes.json();

        if (!metaRes.ok) {
            // Parse Meta-specific errors for better UX
            const metaError = metaData?.error?.message || "Error enviando template a Meta";
            const errorCode = metaData?.error?.code;

            // Common error translations
            if (errorCode === 100 && metaError.includes("name")) {
                return apiError("Ya existe un template con ese nombre. Usa un nombre diferente.", 400);
            }
            if (metaError.includes("duplicate")) {
                return apiError("Ya existe un template con ese nombre. Usa un nombre diferente.", 400);
            }

            return apiError(metaError, metaRes.status);
        }

        return NextResponse.json({
            success: true,
            template_id: metaData.id,
            status: metaData.status || "PENDING",
            message: "Template enviado a revisión de Meta. La aprobación puede tardar entre 1 minuto y 24 horas.",
        });
    } catch (err) {
        return serverError(err, "templates-manage:POST");
    }
}

// ═══════════════════════════════════════════════════════════════
//  DELETE — Delete a WhatsApp template from Meta
// ═══════════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
    try {
        const result = await authenticateRequest("templates-manage:DELETE");
        if ("error" in result) return result.error;
        const { auth } = result;

        const { searchParams } = new URL(req.url);
        const templateName = searchParams.get("name");

        if (!templateName) {
            return apiError("Nombre del template es requerido", 400);
        }

        // Get org WhatsApp credentials
        const db = getSupabaseAdmin();
        const { data: org } = await db
            .from("organizations")
            .select("whatsapp_credentials")
            .eq("id", auth.orgId)
            .single();

        if (!org) return apiError("Organización no encontrada", 404);

        const creds = (org.whatsapp_credentials || {}) as Record<string, string>;
        if (!creds.business_account_id || !creds.access_token) {
            return apiError("WhatsApp no configurado", 400);
        }

        // Delete from Meta
        const metaRes = await fetch(
            `${META_API}/${creds.business_account_id}/message_templates?name=${encodeURIComponent(templateName)}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${creds.access_token}`,
                },
            }
        );

        const metaData = await metaRes.json();

        if (!metaRes.ok) {
            return apiError(
                metaData?.error?.message || "Error eliminando template de Meta",
                metaRes.status
            );
        }

        return NextResponse.json({
            success: true,
            message: "Template eliminado correctamente",
        });
    } catch (err) {
        return serverError(err, "templates-manage:DELETE");
    }
}
