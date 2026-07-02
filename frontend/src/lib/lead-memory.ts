// ═══════════════════════════════════════════════════════════════
//  🧠 LEAD MEMORY — memoria de 3 capas por lead
//
//  Capa corta  : últimos 15 mensajes (loadConversationHistory)
//  Capa media  : resumen progresivo (leads.conversation_summary)
//                → condensa lo que sale de la ventana de 15 msgs
//  Capa larga  : hechos persistentes (lead_memories)
//                → "presupuesto 3.000 UF", "prefiere Ñuñoa";
//                sobreviven entre sesiones y meses
//
//  Todas las escrituras son fire-and-forget desde el procesador:
//  la memoria nunca bloquea ni rompe la respuesta al cliente.
//  Degrada sin romper si las tablas/columnas no existen aún.
// ═══════════════════════════════════════════════════════════════

import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logOpenAiCompletionUsage } from "@/lib/ai-usage";
import { captureError } from "@/lib/monitoring";

// ── Config ──────────────────────────────────────────────────
const SUMMARY_MIN_MESSAGES = 20;      // no resumir conversaciones cortas
const SUMMARY_EVERY_N_MESSAGES = 10;  // re-resumir cada N mensajes nuevos
const SUMMARY_SOURCE_WINDOW = 60;     // mensajes que alimentan el resumen
const EXTRACTION_EVERY_N_USER_MSGS = 6;
const MAX_FACTS_IN_PROMPT = 12;

export interface LeadFact {
    fact: string;
    category: string;
}

// ═══════════════════════════════════════════════════════════════
//  LECTURA — contexto de memoria para el prompt
// ═══════════════════════════════════════════════════════════════

/**
 * Hechos de largo plazo del lead, más recientes primero.
 * Devuelve [] si la tabla no existe (migración pendiente).
 */
export async function getLeadFacts(leadId: string): Promise<LeadFact[]> {
    try {
        const db = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (db as any)
            .from("lead_memories")
            .select("fact, category")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })
            .limit(MAX_FACTS_IN_PROMPT);

        if (error || !data) return [];
        return data as LeadFact[];
    } catch {
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
//  CAPA MEDIA — resumen progresivo
// ═══════════════════════════════════════════════════════════════

/**
 * Actualiza el resumen de la conversación si acumuló suficientes
 * mensajes nuevos desde el último resumen. Se llama fire-and-forget
 * después de cada turno del bot.
 */
export async function maybeUpdateRollingSummary(params: {
    orgId: string;
    leadId: string;
    openaiApiKey: string;
}): Promise<void> {
    const { orgId, leadId, openaiApiKey } = params;

    try {
        const db = getSupabaseAdmin();

        // ¿Cuántos mensajes tiene la conversación en total?
        const { count: totalMessages } = await db
            .from("lead_messages")
            .select("id", { count: "exact", head: true })
            .eq("lead_id", leadId);

        if (!totalMessages || totalMessages < SUMMARY_MIN_MESSAGES) return;

        // ¿Cuántos cubría el último resumen?
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leadRow, error: leadErr } = await (db as any)
            .from("leads")
            .select("conversation_summary, summary_message_count")
            .eq("id", leadId)
            .single();

        if (leadErr) {
            // Columnas inexistentes (42703) → migración pendiente, salir en silencio
            if (leadErr.code !== "42703") {
                captureError(leadErr, "memory:summary:read", { leadId });
            }
            return;
        }

        const covered: number = leadRow?.summary_message_count || 0;
        if (totalMessages - covered < SUMMARY_EVERY_N_MESSAGES) return;

        // Fuente: los últimos N mensajes + el resumen anterior
        const { data: messages } = await db
            .from("lead_messages")
            .select("role, content")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })
            .limit(SUMMARY_SOURCE_WINDOW);

        if (!messages || messages.length === 0) return;

        const transcript = messages
            .reverse()
            .map((m) => `${m.role === "user" ? "Cliente" : "Bot"}: ${m.content}`)
            .join("\n");

        const previousSummary: string = leadRow?.conversation_summary || "";

        const openai = new OpenAI({ apiKey: openaiApiKey });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "Eres un asistente que mantiene el resumen de una conversación de ventas por WhatsApp. " +
                        "Devuelve SOLO el resumen actualizado, en español, máximo 150 palabras, en prosa compacta. " +
                        "Prioriza: qué busca el cliente, presupuesto, zona/preferencias, citas agendadas o canceladas, " +
                        "objeciones, y compromisos pendientes. No inventes nada que no esté en la conversación.",
                },
                {
                    role: "user",
                    content:
                        (previousSummary
                            ? `RESUMEN ANTERIOR:\n${previousSummary}\n\n`
                            : "") +
                        `CONVERSACIÓN RECIENTE:\n${transcript}\n\n` +
                        "Actualiza el resumen integrando la conversación reciente.",
                },
            ],
            max_tokens: 300,
        });

        logOpenAiCompletionUsage(orgId, leadId, "gpt-4o-mini", "summary", completion.usage);

        const newSummary = completion.choices[0]?.message?.content?.trim();
        if (!newSummary) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any)
            .from("leads")
            .update({
                conversation_summary: newSummary,
                summary_message_count: totalMessages,
            })
            .eq("id", leadId);

        console.log(`📝 [Memory] Resumen actualizado para lead ${leadId} (${totalMessages} msgs)`);
    } catch (err) {
        captureError(err, "memory:summary", { orgId, leadId });
    }
}

// ═══════════════════════════════════════════════════════════════
//  CAPA LARGA — extracción de hechos
// ═══════════════════════════════════════════════════════════════

/**
 * Hechos estructurados derivados de una llamada a gestionar_lead_crm
 * — sin costo de LLM extra: la IA ya validó estos datos.
 */
export async function saveCrmDerivedFacts(params: {
    orgId: string;
    leadId: string;
    nombreCliente?: string;
    fechaHoraCita?: string;
}): Promise<void> {
    const { orgId, leadId, nombreCliente, fechaHoraCita } = params;

    try {
        const db = getSupabaseAdmin();
        const facts: Array<{ fact: string; category: string }> = [];

        if (
            nombreCliente &&
            !/^(cliente|lead|lead whatsapp|usuario|n\/a)$/i.test(nombreCliente.trim())
        ) {
            facts.push({
                fact: `Se llama ${nombreCliente.trim()}`,
                category: "personal",
            });
        }

        if (fechaHoraCita) {
            // Las citas cambian: reemplazar la anterior en vez de acumular
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (db as any)
                .from("lead_memories")
                .delete()
                .eq("lead_id", leadId)
                .like("fact", "Cita agendada:%");
            facts.push({
                fact: `Cita agendada: ${fechaHoraCita}`,
                category: "contexto",
            });
        }

        if (facts.length === 0) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (db as any).from("lead_memories").upsert(
            facts.map((f) => ({
                organization_id: orgId,
                lead_id: leadId,
                fact: f.fact,
                category: f.category,
                source: "crm_tool",
            })),
            { onConflict: "lead_id,fact", ignoreDuplicates: true }
        );

        if (error && error.code !== "42P01") {
            captureError(error, "memory:crm_facts", { orgId, leadId });
        }
    } catch (err) {
        captureError(err, "memory:crm_facts", { orgId, leadId });
    }
}

/**
 * Extracción periódica de hechos con LLM: cada N mensajes del
 * cliente, revisa la conversación reciente y guarda hechos NUEVOS
 * (comparados contra los ya conocidos). Fire-and-forget.
 */
export async function maybeExtractMemories(params: {
    orgId: string;
    leadId: string;
    openaiApiKey: string;
}): Promise<void> {
    const { orgId, leadId, openaiApiKey } = params;

    try {
        const db = getSupabaseAdmin();

        // Gatillo: cada N mensajes del cliente
        const { count: userMsgCount } = await db
            .from("lead_messages")
            .select("id", { count: "exact", head: true })
            .eq("lead_id", leadId)
            .eq("role", "user");

        if (
            !userMsgCount ||
            userMsgCount < EXTRACTION_EVERY_N_USER_MSGS ||
            userMsgCount % EXTRACTION_EVERY_N_USER_MSGS !== 0
        ) {
            return;
        }

        // Hechos ya conocidos (para pedir solo NOVEDADES)
        const existing = await getLeadFacts(leadId);
        const existingList = existing.map((f) => `- ${f.fact}`).join("\n") || "(ninguno)";

        // Conversación reciente
        const { data: messages } = await db
            .from("lead_messages")
            .select("role, content")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })
            .limit(30);

        if (!messages || messages.length === 0) return;

        const transcript = messages
            .reverse()
            .map((m) => `${m.role === "user" ? "Cliente" : "Bot"}: ${m.content}`)
            .join("\n");

        const openai = new OpenAI({ apiKey: openaiApiKey });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "Extraes hechos persistentes sobre un cliente a partir de una conversación de ventas. " +
                        "Un hecho persistente es información que seguirá siendo útil en semanas o meses: nombre, presupuesto, " +
                        "zona o preferencias, composición familiar, mascota, urgencia, profesión, restricciones. " +
                        "NO son hechos: saludos, la pregunta puntual del día, ni nada ya presente en la lista de hechos conocidos. " +
                        'Responde SOLO con JSON válido: {"facts":[{"fact":"...","category":"personal|presupuesto|preferencia|contexto"}]} ' +
                        "Máximo 4 hechos, cada uno de menos de 12 palabras, en español. Si no hay hechos nuevos: {\"facts\":[]}",
                },
                {
                    role: "user",
                    content:
                        `HECHOS YA CONOCIDOS:\n${existingList}\n\n` +
                        `CONVERSACIÓN:\n${transcript}`,
                },
            ],
            response_format: { type: "json_object" },
            max_tokens: 250,
        });

        logOpenAiCompletionUsage(orgId, leadId, "gpt-4o-mini", "memory_extraction", completion.usage);

        const raw = completion.choices[0]?.message?.content || "{}";
        let parsedFacts: Array<{ fact: string; category?: string }> = [];
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.facts)) parsedFacts = parsed.facts;
        } catch {
            return; // JSON inválido → descartar en silencio
        }

        const VALID_CATEGORIES = ["personal", "presupuesto", "preferencia", "contexto", "general"];
        const rows = parsedFacts
            .filter((f) => f?.fact && typeof f.fact === "string" && f.fact.length <= 120)
            .slice(0, 4)
            .map((f) => ({
                organization_id: orgId,
                lead_id: leadId,
                fact: f.fact.trim(),
                category: VALID_CATEGORIES.includes(f.category || "") ? f.category : "general",
                source: "ai",
            }));

        if (rows.length === 0) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (db as any)
            .from("lead_memories")
            .upsert(rows, { onConflict: "lead_id,fact", ignoreDuplicates: true });

        if (error && error.code !== "42P01") {
            captureError(error, "memory:extract", { orgId, leadId });
        } else if (!error) {
            console.log(`🧩 [Memory] ${rows.length} hecho(s) extraído(s) para lead ${leadId}`);
        }
    } catch (err) {
        captureError(err, "memory:extract", { orgId, leadId });
    }
}
