// ═══════════════════════════════════════════════════════════════
//  🎤 AUDIO TRANSCRIPTION — voz a texto para WhatsApp (Meta)
//
//  En Chile los clientes mandan audios masivamente. Flujo:
//    1. Meta Graph API: media_id → URL firmada del binario
//    2. Descarga del audio (ogg/opus típicamente, ≤16 MB)
//    3. OpenAI Whisper (whisper-1, verbose_json para duración)
//    4. El texto transcrito entra al flujo NORMAL del procesador
//
//  Manejo de fallos (audio corrupto, tamaño excedido, timeouts,
//  token vencido): SIEMPRE devuelve un fallbackText para que el
//  bot pida al cliente que escriba — la conversación nunca muere.
// ═══════════════════════════════════════════════════════════════

import OpenAI, { toFile } from "openai";
import { logAiUsage } from "@/lib/ai-usage";
import { captureError } from "@/lib/monitoring";

// WhatsApp limita audios a 16 MB; Whisper acepta hasta 25 MB.
// Usamos el límite de WhatsApp como techo defensivo.
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;
const META_FETCH_TIMEOUT_MS = 10_000;
const MEDIA_DOWNLOAD_TIMEOUT_MS = 20_000;
const WHISPER_TIMEOUT_MS = 60_000;
const META_API = "https://graph.facebook.com/v22.0";

export type TranscriptionFailReason =
    | "media_lookup_failed"   // Meta no devolvió la URL (id inválido/token vencido)
    | "download_failed"       // no se pudo bajar el binario
    | "too_large"             // excede el límite de tamaño
    | "empty_audio"           // 0 bytes / corrupto evidente
    | "whisper_failed"        // OpenAI rechazó el archivo (corrupto/formato)
    | "empty_transcript"      // Whisper devolvió texto vacío
    | "unexpected";

export type TranscriptionResult =
    | { ok: true; text: string; durationSeconds: number | null }
    | { ok: false; reason: TranscriptionFailReason; fallbackText: string };

// Placeholder que entra al historial cuando la transcripción falla:
// le da contexto a la IA para pedir el mensaje por texto.
const FALLBACKS: Record<TranscriptionFailReason, string> = {
    media_lookup_failed:
        "[El cliente envió un mensaje de voz que no se pudo recuperar. Pídele amablemente que escriba su consulta por texto.]",
    download_failed:
        "[El cliente envió un mensaje de voz que no se pudo descargar. Pídele amablemente que escriba su consulta por texto.]",
    too_large:
        "[El cliente envió un audio demasiado largo para procesar. Pídele amablemente que envíe un audio más corto o escriba su consulta.]",
    empty_audio:
        "[El cliente envió un audio vacío o dañado. Pídele amablemente que lo reenvíe o escriba su consulta.]",
    whisper_failed:
        "[El cliente envió un audio que no se pudo transcribir. Pídele amablemente que escriba su consulta por texto.]",
    empty_transcript:
        "[El cliente envió un audio sin voz detectable. Pídele amablemente que escriba su consulta por texto.]",
    unexpected:
        "[El cliente envió un mensaje de voz que no se pudo procesar. Pídele amablemente que escriba su consulta por texto.]",
};

function fail(reason: TranscriptionFailReason): TranscriptionResult {
    return { ok: false, reason, fallbackText: FALLBACKS[reason] };
}

export interface TranscribeMetaAudioParams {
    orgId: string;
    leadId?: string | null;
    mediaId: string;
    mimeType?: string;
    /** access_token de WhatsApp del tenant (Meta Cloud API) */
    accessToken: string;
    /** API key de OpenAI del tenant */
    openaiApiKey: string;
}

/**
 * Descarga un audio de WhatsApp (Meta) y lo transcribe con Whisper.
 * NUNCA lanza: todo fallo devuelve { ok: false } con fallbackText.
 */
export async function transcribeMetaAudio(
    params: TranscribeMetaAudioParams
): Promise<TranscriptionResult> {
    const { orgId, leadId, mediaId, mimeType, accessToken, openaiApiKey } = params;

    try {
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
                    `🎤 [Whisper] Meta media lookup ${metaRes.status} (org ${orgId}):`,
                    errBody?.error?.message || ""
                );
                return fail("media_lookup_failed");
            }
            const meta = await metaRes.json();
            if (!meta?.url) return fail("media_lookup_failed");
            mediaUrl = meta.url;
            expectedBytes = Number(meta.file_size) || 0;

            // Corte temprano si Meta ya declara un tamaño excesivo
            if (expectedBytes > MAX_AUDIO_BYTES) {
                console.warn(`🎤 [Whisper] Audio de ${expectedBytes} bytes excede el límite (org ${orgId})`);
                return fail("too_large");
            }
        } catch (err) {
            captureError(err, "whisper:media_lookup", { orgId, mediaId });
            return fail("media_lookup_failed");
        }

        // ── 2. Descargar el binario ───────────────────────────
        let audioBuffer: ArrayBuffer;
        try {
            const dlRes = await fetch(mediaUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
                signal: AbortSignal.timeout(MEDIA_DOWNLOAD_TIMEOUT_MS),
            });
            if (!dlRes.ok) {
                console.warn(`🎤 [Whisper] Descarga de media ${dlRes.status} (org ${orgId})`);
                return fail("download_failed");
            }
            audioBuffer = await dlRes.arrayBuffer();
        } catch (err) {
            captureError(err, "whisper:download", { orgId, mediaId });
            return fail("download_failed");
        }

        // ── 3. Validaciones defensivas del binario ────────────
        if (audioBuffer.byteLength === 0) return fail("empty_audio");
        if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
            console.warn(`🎤 [Whisper] Binario de ${audioBuffer.byteLength} bytes excede el límite (org ${orgId})`);
            return fail("too_large");
        }

        // ── 4. Whisper ────────────────────────────────────────
        try {
            const openai = new OpenAI({
                apiKey: openaiApiKey,
                timeout: WHISPER_TIMEOUT_MS,
            });

            // Extensión coherente con el mime (WhatsApp: audio/ogg; codecs=opus)
            const ext = mimeType?.includes("mpeg") ? "mp3"
                : mimeType?.includes("mp4") ? "m4a"
                : mimeType?.includes("amr") ? "amr"
                : "ogg";

            const file = await toFile(
                Buffer.from(audioBuffer),
                `whatsapp-audio.${ext}`,
                { type: mimeType?.split(";")[0] || "audio/ogg" }
            );

            const transcription = await openai.audio.transcriptions.create({
                model: "whisper-1",
                file,
                language: "es",
                // verbose_json → incluye duration (para telemetría de costo)
                response_format: "verbose_json",
            });

            // verbose_json incluye duration; el tipo del SDK varía
            // según el response_format — tipamos la forma esperada
            const verbose = transcription as { text?: string; duration?: number };
            const text = (verbose.text || "").trim();
            const durationSeconds: number | null =
                typeof verbose.duration === "number"
                    ? Math.round(verbose.duration)
                    : null;

            // 📊 Telemetría: Whisper cobra por minuto, no por token.
            // Convención: total_tokens = segundos de audio (documentado
            // aquí; el impacto en el costo estimado del panel es ~0).
            void logAiUsage({
                orgId,
                leadId,
                model: "whisper-1",
                purpose: "transcription",
                totalTokens: durationSeconds ?? 0,
            });

            if (!text) return fail("empty_transcript");

            console.log(
                `🎤 [Whisper] Transcrito ${durationSeconds ?? "?"}s de audio (org ${orgId}): "${text.slice(0, 80)}..."`
            );
            return { ok: true, text, durationSeconds };
        } catch (err) {
            // Audio corrupto, formato no soportado, rate limit, etc.
            captureError(err, "whisper:transcribe", { orgId, mediaId, bytes: audioBuffer.byteLength });
            return fail("whisper_failed");
        }
    } catch (err) {
        captureError(err, "whisper:unexpected", { orgId, mediaId });
        return fail("unexpected");
    }
}
