// ═══════════════════════════════════════════════════════════════
//  👁️ IMAGE ANALYSIS — visión artificial para WhatsApp (Meta)
//
//  En LATAM los clientes mandan FOTOS (producto, receta, comprobante,
//  screenshot). Flujo — calcado del pipeline de audio (Whisper):
//    1. Meta Graph API: media_id → URL firmada del binario
//    2. Descarga de la imagen (jpeg/png/webp, ≤5 MB)
//    3. gpt-4o-mini (multimodal, MISMO modelo del chat) describe la
//       imagen en el contexto del negocio del tenant
//    4. La descripción entra al flujo NORMAL: el RAG responde sobre
//       lo que la IA "vio", cruzándolo con el catálogo del tenant
//
//  Manejo de fallos (corrupta, muy grande, timeout, token vencido):
//  SIEMPRE devuelve un fallbackText para que el bot pida al cliente
//  que describa por texto — la conversación nunca muere.
// ═══════════════════════════════════════════════════════════════

import OpenAI from "openai";
import { logOpenAiCompletionUsage } from "@/lib/ai-usage";
import { captureError } from "@/lib/monitoring";

// WhatsApp limita imágenes a 5 MB. gpt-4o acepta más, pero es techo
// defensivo (además cap de tokens del prompt de visión).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const META_FETCH_TIMEOUT_MS = 10_000;
const MEDIA_DOWNLOAD_TIMEOUT_MS = 20_000;
const VISION_TIMEOUT_MS = 40_000;
const META_API = "https://graph.facebook.com/v22.0";
const VISION_MODEL = "gpt-4o-mini"; // multimodal, ya en el stack

export type VisionFailReason =
    | "media_lookup_failed"
    | "download_failed"
    | "too_large"
    | "empty_image"
    | "unsupported_type"
    | "vision_failed"
    | "empty_description"
    | "unexpected";

export type VisionResult =
    | { ok: true; description: string }
    | { ok: false; reason: VisionFailReason; fallbackText: string };

const FALLBACKS: Record<VisionFailReason, string> = {
    media_lookup_failed:
        "[El cliente envió una imagen que no se pudo recuperar. Pídele amablemente que describa por texto lo que necesita.]",
    download_failed:
        "[El cliente envió una imagen que no se pudo descargar. Pídele amablemente que describa por texto lo que busca.]",
    too_large:
        "[El cliente envió una imagen demasiado grande para procesar. Pídele que envíe una foto más liviana o describa lo que necesita.]",
    empty_image:
        "[El cliente envió una imagen vacía o dañada. Pídele amablemente que la reenvíe o describa su consulta.]",
    unsupported_type:
        "[El cliente envió una imagen en un formato no soportado. Pídele que envíe una foto normal (JPG o PNG) o describa lo que busca.]",
    vision_failed:
        "[El cliente envió una imagen que no se pudo analizar. Pídele amablemente que describa por texto lo que necesita.]",
    empty_description:
        "[El cliente envió una imagen sin contenido reconocible. Pídele amablemente que describa lo que busca.]",
    unexpected:
        "[El cliente envió una imagen que no se pudo procesar. Pídele amablemente que describa por texto lo que necesita.]",
};

function fail(reason: VisionFailReason): VisionResult {
    return { ok: false, reason, fallbackText: FALLBACKS[reason] };
}

const SUPPORTED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export interface AnalyzeMetaImageParams {
    orgId: string;
    leadId?: string | null;
    mediaId: string;
    mimeType?: string;
    /** caption que el cliente escribió junto a la imagen (contexto) */
    caption?: string;
    /** nombre del negocio (orienta la descripción al rubro) */
    businessName?: string;
    /** access_token de WhatsApp del tenant (Meta Cloud API) */
    accessToken: string;
    /** API key de OpenAI del tenant */
    openaiApiKey: string;
}

/**
 * Descarga una imagen de WhatsApp (Meta) y la describe con visión.
 * NUNCA lanza: todo fallo devuelve { ok: false } con fallbackText.
 */
export async function analyzeMetaImage(
    params: AnalyzeMetaImageParams
): Promise<VisionResult> {
    const { orgId, leadId, mediaId, mimeType, caption, businessName, accessToken, openaiApiKey } = params;

    try {
        // ── 0. Filtro temprano de tipo ────────────────────────
        const baseMime = (mimeType || "").split(";")[0].trim();
        if (baseMime && !SUPPORTED_MIME.includes(baseMime)) {
            return fail("unsupported_type");
        }

        // ── 1. media_id → URL firmada ─────────────────────────
        let mediaUrl: string;
        let expectedBytes = 0;
        try {
            const metaRes = await fetch(`${META_API}/${mediaId}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS),
            });
            if (!metaRes.ok) {
                const errBody = await metaRes.json().catch(() => ({}));
                console.warn(
                    `👁️ [Vision] Meta media lookup ${metaRes.status} (org ${orgId}):`,
                    errBody?.error?.message || ""
                );
                return fail("media_lookup_failed");
            }
            const meta = await metaRes.json();
            if (!meta?.url) return fail("media_lookup_failed");
            mediaUrl = meta.url;
            expectedBytes = Number(meta.file_size) || 0;
            if (expectedBytes > MAX_IMAGE_BYTES) {
                console.warn(`👁️ [Vision] Imagen de ${expectedBytes} bytes excede el límite (org ${orgId})`);
                return fail("too_large");
            }
        } catch (err) {
            captureError(err, "vision:media_lookup", { orgId, mediaId });
            return fail("media_lookup_failed");
        }

        // ── 2. Descargar el binario ───────────────────────────
        let imageBuffer: ArrayBuffer;
        try {
            const dlRes = await fetch(mediaUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
                signal: AbortSignal.timeout(MEDIA_DOWNLOAD_TIMEOUT_MS),
            });
            if (!dlRes.ok) {
                console.warn(`👁️ [Vision] Descarga de media ${dlRes.status} (org ${orgId})`);
                return fail("download_failed");
            }
            imageBuffer = await dlRes.arrayBuffer();
        } catch (err) {
            captureError(err, "vision:download", { orgId, mediaId });
            return fail("download_failed");
        }

        // ── 3. Validaciones defensivas del binario ────────────
        if (imageBuffer.byteLength === 0) return fail("empty_image");
        if (imageBuffer.byteLength > MAX_IMAGE_BYTES) {
            console.warn(`👁️ [Vision] Binario de ${imageBuffer.byteLength} bytes excede el límite (org ${orgId})`);
            return fail("too_large");
        }

        // ── 4. Visión (gpt-4o-mini multimodal) ────────────────
        try {
            const openai = new OpenAI({ apiKey: openaiApiKey, timeout: VISION_TIMEOUT_MS });
            const dataUrl =
                `data:${baseMime || "image/jpeg"};base64,` +
                Buffer.from(imageBuffer).toString("base64");

            const businessCtx = businessName ? ` del negocio "${businessName}"` : "";
            const captionCtx = caption?.trim()
                ? ` El cliente escribió junto a la imagen: "${caption.trim()}".`
                : "";

            const completion = await openai.chat.completions.create({
                model: VISION_MODEL,
                max_tokens: 300,
                messages: [
                    {
                        role: "system",
                        content:
                            `Eres el asistente de visión de un agente de ventas${businessCtx}. ` +
                            "Describe de forma CONCISA y ÚTIL lo que hay en la imagen que envió un cliente por WhatsApp, " +
                            "pensando en cómo ayudarlo a comprar o resolver su consulta. " +
                            "Si es un producto, describe tipo, color, marca visible, características. " +
                            "Si es un documento/comprobante/screenshot, resume su contenido clave (montos, fechas, nombres). " +
                            "NO inventes datos que no se ven. NO saludes ni agregues relleno. Responde en español, máximo 3 frases.",
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: `¿Qué se ve en esta imagen?${captionCtx}` },
                            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
                        ],
                    },
                ],
            });

            logOpenAiCompletionUsage(orgId, leadId ?? null, VISION_MODEL, "vision", completion.usage);

            const description = (completion.choices[0]?.message?.content || "").trim();
            if (!description) return fail("empty_description");

            console.log(`👁️ [Vision] Imagen analizada (org ${orgId}): "${description.slice(0, 80)}..."`);
            return { ok: true, description };
        } catch (err) {
            captureError(err, "vision:analyze", { orgId, mediaId, bytes: imageBuffer.byteLength });
            return fail("vision_failed");
        }
    } catch (err) {
        captureError(err, "vision:unexpected", { orgId, mediaId });
        return fail("unexpected");
    }
}
