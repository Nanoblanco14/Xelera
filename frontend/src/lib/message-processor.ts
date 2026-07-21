// ═══════════════════════════════════════════════════════════════
//  🧠 MESSAGE PROCESSOR — pipeline de IA para un turno de conversación
//
//  Extraído del webhook para poder invocarse de forma asíncrona:
//  el webhook responde 200 al instante, encola el mensaje, y este
//  procesador corre después del debounce (o desde el sweeper del
//  cron) con el LOTE completo de mensajes de la ráfaga.
//
//  El texto entrante ya está persistido en lead_messages por el
//  webhook — aquí solo se carga historial, se llama a OpenAI (con
//  tools de CRM y citas), se persiste la respuesta y se envía.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type {
    ChatCompletionMessageParam,
    ChatCompletionTool,
} from "openai/resources/chat/completions";
import { isAppointmentCriticalIndustry } from "@/lib/industry-templates";
import { getAvailableSlots, bookAppointment, cancelAppointment, rescheduleAppointment, getBusinessHours, getAppointmentConfig, businessHoursToText, formatChileDate } from "@/lib/appointments";
import { sendAutoTemplate, type AutoTemplateEvent } from "@/lib/auto-templates";
import { notifyOwnerHotLead } from "@/lib/owner-alerts";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { logOpenAiCompletionUsage } from "@/lib/ai-usage";
import { captureError } from "@/lib/monitoring";
import {
    getLeadFacts,
    maybeUpdateRollingSummary,
    maybeExtractMemories,
    saveCrmDerivedFacts,
} from "@/lib/lead-memory";
import {
    orgHasKnowledgeIndex,
    retrieveKnowledge,
} from "@/lib/knowledge-indexer";
import { trackEvent } from "@/lib/analytics";
import { checkAiBudget, getPlanLimits } from "@/lib/plan-limits";
import { emitOutboundEvent } from "@/lib/outbound-webhooks";
import { linkOutboundMessage, markOutboundFailed } from "@/lib/delivery-status";
import { z } from "zod/v4";

// ═══════════════════════════════════════════════════════════════
//  🛡️ ZOD SCHEMA — Validación de argumentos de gestionar_lead_crm
// ═══════════════════════════════════════════════════════════════
const CRMToolArgsSchema = z.object({
    nombre_cliente: z.string().min(2, "Nombre demasiado corto").refine(
        (val) => !/^(cliente|lead|n\/a|usuario|desconocido|lead whatsapp)$/i.test(val.trim()),
        "Nombre genérico no permitido — debe ser el nombre real del cliente"
    ),
    estado_filtro: z.enum(["Interesado", "Calificado", "Descartado", "Derivado a Humano"]),
    fecha_hora_cita: z.string().optional(),
    resumen_conversacion: z.string().min(5, "Resumen demasiado corto"),
    // 🌡️ Lead Scoring — el LLM infiere la intención de compra en la
    // misma llamada. Opcional para no romper llamadas legacy.
    temperatura: z.enum(["caliente", "tibio", "frio"]).optional(),
});

// ═══════════════════════════════════════════════════════════════
//  🔄 STAGE TRANSITION VALIDATOR
// ═══════════════════════════════════════════════════════════════
async function validateAndRecordTransition(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: any,
    orgId: string,
    leadId: string,
    fromStageId: string | null,
    toStageId: string,
    changedBy: "ai" | "human" | "system",
    reason: string,
    metadata: Record<string, unknown> = {}
): Promise<{ valid: boolean; message: string }> {
    // If no change, skip
    if (fromStageId === toStageId) {
        return { valid: true, message: "Sin cambio de etapa" };
    }

    // Check if org has rules configured
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbAny = db as any;
    const { data: rulesExist } = await dbAny
        .from("pipeline_stage_rules")
        .select("id")
        .eq("organization_id", orgId)
        .limit(1);

    if (rulesExist && rulesExist.length > 0 && fromStageId) {
        // Validate transition against rules
        const { data: ruleData } = await dbAny
            .from("pipeline_stage_rules")
            .select("id, is_ai_allowed")
            .eq("organization_id", orgId)
            .eq("from_stage_id", fromStageId)
            .eq("to_stage_id", toStageId)
            .limit(1);

        const rule = ruleData as { id: string; is_ai_allowed: boolean }[] | null;

        if (!rule || rule.length === 0) {
            console.warn(`⚠️ Transición no permitida: ${fromStageId} → ${toStageId}`);
            return { valid: false, message: "Transición no permitida por las reglas del pipeline" };
        }

        if (changedBy === "ai" && !rule[0].is_ai_allowed) {
            console.warn(`⚠️ IA no puede hacer esta transición: ${fromStageId} → ${toStageId}`);
            return { valid: false, message: "La IA no tiene permiso para esta transición" };
        }
    }

    // Record in history (always, even if no rules exist)
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).from("lead_stage_history").insert({
            lead_id: leadId,
            organization_id: orgId,
            from_stage_id: fromStageId,
            to_stage_id: toStageId,
            changed_by: changedBy,
            reason,
            metadata,
        });
    } catch (historyErr) {
        // Non-blocking — don't fail the transition if history insert fails
        console.error("⚠️ Error guardando historial (no bloqueante):", historyErr);
    }

    // 📈 Evento: transición de etapa
    trackEvent({
        orgId,
        leadId,
        type: "stage_changed",
        metadata: { from: fromStageId, to: toStageId, by: changedBy },
    }).catch(() => { /* no bloquear */ });

    return { valid: true, message: "Transición válida" };
}

// ── Supabase Admin (bypasses RLS for webhook) ───────────────
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// ═══════════════════════════════════════════════════════════════
//  🔧 TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════

const gestionarLeadCrmTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "gestionar_lead_crm",
        description:
            "Actualiza el estado del lead en el CRM. " +
            "REGLA DE ORO: Cada acción que confirmes en el chat DEBE ir acompañada de la llamada a esta herramienta. " +
            "Si dices (o implicas) que agendaste una cita, DEBES llamar a esta función con estado_filtro=\"Calificado\" de forma inmediata, en el mismo turno. " +
            "Si NO llamas a la herramienta, el CRM quedará desactualizado y el lead se perderá. " +
            "Llama a esta función en los siguientes casos exactos: " +
            "(1) El cliente muestra interés activo (pregunta precios, pide información, compara opciones) → usa estado_filtro=\"Interesado\". " +
            "(2) El cliente confirma explícitamente un día Y hora para una cita/visita → usa estado_filtro=\"Calificado\". " +
            "(3) El cliente rechaza de forma definitiva, insulta, o dice explícitamente que ya NO le interesa → usa estado_filtro=\"Descartado\". " +
            "(4) La regla de escalación se cumple → usa estado_filtro=\"Derivado a Humano\".",
        parameters: {
            type: "object",
            properties: {
                nombre_cliente: {
                    type: "string",
                    description:
                        "El nombre y apellido real del usuario. " +
                        "REGLA ESTRICTA: Tienes PROHIBIDO usar valores genéricos como 'Cliente', 'Lead', 'Usuario', 'Lead WhatsApp' o 'N/A'. " +
                        "Si el usuario NO te ha dicho su nombre explícitamente en la conversación activa, NO PUEDES ejecutar esta herramienta. " +
                        "Debes preguntarle su nombre primero y esperar su respuesta antes de invocar la función.",
                },
                estado_filtro: {
                    type: "string",
                    enum: ["Interesado", "Calificado", "Descartado", "Derivado a Humano"],
                    description:
                        "Interesado = el cliente muestra interés activo (pregunta precios, solicita info, compara opciones) pero aún no confirma cita. Muévelo a la etapa 'Interesado' del pipeline. " +
                        "Calificado = el prospecto confirmó explícitamente un día Y hora para la cita/visita. Debes moverlo a la etapa de visita/reunión del pipeline. " +
                        "Descartado = el cliente dijo EXPLÍCITAMENTE que NO le interesa, o terminó la conversación de forma negativa o con insultos. " +
                        "NUNCA uses 'Descartado' porque el cliente está pensando, porque no respondió, o porque está agendando una cita — eso es lo OPUESTO de Descartado. " +
                        "⛔ REGLA CRÍTICA DE REPROGRAMACIÓN: Si el cliente pide cambiar la fecha u hora de una cita ya agendada ('¿puedo cambiar la hora?', 'necesito mover la cita'), " +
                        "esto es una señal de ALTO INTERÉS. NUNCA uses 'Descartado' en este caso. Debes mantener 'Calificado' o moverlo a la etapa de visita agendada. " +
                        "SOLO usa 'Descartado' si el cliente rechaza EXPLÍCITAMENTE el servicio, dice que ya no le interesa, o pide no ser contactado. " +
                        "Derivado a Humano = prospecto requiere atención especializada según la regla de escalación configurada.",
                },
                fecha_hora_cita: {
                    type: "string",
                    description:
                        "Fecha y hora de la cita en formato ISO 8601 (ej: 2026-02-26T11:00:00). " +
                        "OBLIGATORIO cuando estado_filtro es 'Calificado'. Omitir en otros casos.",
                },
                resumen_conversacion: {
                    type: "string",
                    description:
                        "Resumen breve con los datos clave: nombre, presupuesto, zona de interés, tipo de propiedad/servicio, fecha y hora de la cita si aplica, motivo de descarte o derivación si aplica.",
                },
                temperatura: {
                    type: "string",
                    enum: ["caliente", "tibio", "frio"],
                    description:
                        "Clasifica la INTENCIÓN DE COMPRA del cliente según toda la conversación: " +
                        "'caliente' = alta intención (confirmó cita, pidió cerrar/pagar, dio presupuesto concreto y urgencia, o dijo 'lo quiero'). " +
                        "'tibio' = interés real pero sin decisión (pregunta precios, compara opciones, evalúa, 'lo pensaré'). " +
                        "'frio' = curioseando o baja intención (solo mira, sin presupuesto, 'después veo', respuestas vagas). " +
                        "Infiere esto SIEMPRE que llames a la herramienta, basándote en las señales reales del cliente.",
                },
            },
            required: [
                "nombre_cliente",
                "estado_filtro",
                "resumen_conversacion",
                "temperatura",
            ],
        },
    },
};

const verificarDisponibilidadTool: ChatCompletionTool = {
    type: "function" as const,
    function: {
        name: "verificar_disponibilidad",
        description: "Consulta los horarios disponibles para agendar una cita. SIEMPRE usa esta herramienta ANTES de ofrecer un horario al cliente. NUNCA ofrezcas un horario sin verificar disponibilidad primero.",
        parameters: {
            type: "object" as const,
            properties: {
                fecha: {
                    type: "string",
                    description: "Fecha a consultar en formato YYYY-MM-DD. Calcula la fecha exacta basándote en la fecha actual si el cliente usa términos relativos ('mañana', 'el viernes', etc.).",
                },
                servicio_nombre: {
                    type: "string",
                    description: "Nombre del servicio o producto (opcional). Permite ajustar la duración del slot.",
                },
            },
            required: ["fecha"],
        },
    },
};

const agendarCitaTool: ChatCompletionTool = {
    type: "function" as const,
    function: {
        name: "agendar_cita",
        description: "Crea una cita confirmada. REGLA ABSOLUTA: Solo usar DESPUÉS de (1) verificar disponibilidad, (2) el cliente confirme fecha y hora explícitamente, y (3) tengas su nombre real.",
        parameters: {
            type: "object" as const,
            properties: {
                nombre_cliente: {
                    type: "string",
                    description: "Nombre real del cliente.",
                },
                fecha_hora: {
                    type: "string",
                    description: "Fecha y hora ISO 8601 (ej: 2026-03-15T09:00:00).",
                },
                servicio_nombre: {
                    type: "string",
                    description: "Nombre del servicio/producto para la cita.",
                },
                notas: {
                    type: "string",
                    description: "Notas adicionales (opcional).",
                },
            },
            required: ["nombre_cliente", "fecha_hora", "servicio_nombre"],
        },
    },
};

const gestionarCitaTool: ChatCompletionTool = {
    type: "function" as const,
    function: {
        name: "gestionar_cita_existente",
        description: "Cancela o reprograma una cita existente del cliente.",
        parameters: {
            type: "object" as const,
            properties: {
                accion: {
                    type: "string",
                    enum: ["cancelar", "reprogramar"],
                    description: "Acción a realizar.",
                },
                nueva_fecha_hora: {
                    type: "string",
                    description: "Nueva fecha/hora ISO 8601. Obligatorio si accion='reprogramar'.",
                },
                motivo: {
                    type: "string",
                    description: "Motivo de la cancelación/reprogramación.",
                },
            },
            required: ["accion"],
        },
    },
};

function buildToolsForOrg(hasAppointmentConfig: boolean): ChatCompletionTool[] {
    const baseTools: ChatCompletionTool[] = [gestionarLeadCrmTool];
    if (hasAppointmentConfig) {
        baseTools.push(verificarDisponibilidadTool, agendarCitaTool, gestionarCitaTool);
    }
    return baseTools;
}

// ═══════════════════════════════════════════════════════════════
//  🧠 SYSTEM PROMPT — Builds the dynamic prompt per tenant
// ═══════════════════════════════════════════════════════════════
interface FaqEntry { question: string; answer: string; }

function buildSystemPrompt(
    tenantSystemPrompt: string,
    conversationTone?: string | null,
    escalationRule?: string | null,
    pipelineStages?: string[],
    catalogText?: string | null,
    scrapedContext?: string | null,
    industry?: string | null,
    faqEntries?: FaqEntry[] | null,
    // ── Fase 2: memoria + RAG unificado ──
    conversationSummary?: string | null,
    memoryFacts?: string[] | null,
    retrievedKnowledge?: string | null
): string {
    const now = new Date();
    const chileDate = now.toLocaleDateString("es-CL", {
        timeZone: "America/Santiago",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const chileTime = now.toLocaleTimeString("es-CL", {
        timeZone: "America/Santiago",
        hour: "2-digit",
        minute: "2-digit",
    });
    const chileFull = now.toLocaleString("es-CL", {
        timeZone: "America/Santiago",
    });

    // ── Tone instruction block ─────────────────────────────
    const toneBlock = conversationTone
        ? `\n\n═══ TONO DE CONVERSACIÓN ═══
🎭 El tenant ha configurado este tono para todas las conversaciones: "${conversationTone}".
Adapta tu vocabulario, nivel de formalidad y estilo de escritura para reflejar ese tono en cada mensaje.`
        : "";

    // ── Escalation rule block ──────────────────────────────
    const escalationBlock = escalationRule
        ? `\n\n═══ REGLA DE DERIVACIÓN A HUMANO ═══
⚠️ Cuando detectes la siguiente situación, llama INMEDIATAMENTE a gestionar_lead_crm con estado_filtro="Derivado a Humano":
"${escalationRule}"
No intentes resolver esa situación tú mismo. Deriva de inmediato y notifica cordialmente al cliente que un asesor humano se contactará pronto.`
        : "";

    // ── Pipeline stages block ──────────────────────────────
    const stagesBlock = pipelineStages && pipelineStages.length > 0
        ? `\n\n═══ ETAPAS DEL PIPELINE DE VENTAS (REAL) ═══
Estas son las etapas EXACTAS que existen en el CRM del cliente. Debes usar ÚNICAMENTE estos nombres al llamar a la herramienta gestionar_lead_crm:
${pipelineStages.map((s, i) => `${i + 1}. ${s}`).join("\n")}
USA SIEMPRE el nombre exacto de la etapa, sin inventar variantes.`
        : "";

    // ── Catalog block ──────────────────────────────────────
    const catalogBlock = catalogText
        ? `\n\n═══ CATÁLOGO DE PRODUCTOS/SERVICIOS ═══
${catalogText}
USA ESTA INFORMACIÓN para responder preguntas sobre disponibilidad, precios y características. No menciones productos que no estén en este listado.`
        : "";

    // ── Scraped context block ──────────────────────────────
    const knowledgeBlock = scrapedContext
        ? `\n\n═══ CONOCIMIENTO ADICIONAL DE LA EMPRESA ═══
${scrapedContext}
Usa este conocimiento para responder preguntas generales sobre la empresa, sus servicios, ubicación o cualquier otra información mencionada arriba.`
        : "";

    // ── FAQ block ─────────────────────────────────────────────
    const faqBlock = faqEntries && faqEntries.length > 0
        ? `\n\n═══ PREGUNTAS FRECUENTES (FAQ) ═══
El dueño del negocio ha definido estas respuestas oficiales. Cuando un cliente pregunte algo similar, USA ESTAS RESPUESTAS como base (puedes adaptarlas al tono de la conversación pero mantén la información exacta):
${faqEntries.map((f, i) => `${i + 1}. P: ${f.question}\n   R: ${f.answer}`).join("\n\n")}
IMPORTANTE: Estas respuestas son la fuente de verdad del negocio. No inventes información distinta a lo indicado aquí.`
        : "";

    // ── RAG unificado: conocimiento recuperado para ESTE turno ──
    // (cuando existe, reemplaza a scraped/faq completos)
    const retrievedBlock = retrievedKnowledge
        ? `\n\n═══ CONOCIMIENTO DEL NEGOCIO RELEVANTE PARA ESTA CONSULTA ═══
Fragmentos oficiales (FAQs y material de la empresa) seleccionados por relevancia semántica con el mensaje del cliente:
${retrievedKnowledge}
Estas son respuestas oficiales del negocio: úsalas como fuente de verdad y adáptalas al tono de la conversación. Si la consulta no se responde con estos fragmentos, NO inventes — ofrece derivar a un asesor.`
        : "";

    // ── Fase 2: memoria de largo plazo del cliente ─────────────
    const memoryBlock = memoryFacts && memoryFacts.length > 0
        ? `\n\n═══ MEMORIA DEL CLIENTE (hechos confirmados en conversaciones previas) ═══
${memoryFacts.map((f) => `• ${f}`).join("\n")}
Usa estos datos con naturalidad: saluda por su nombre si lo conoces, no vuelvas a preguntar lo que ya sabes, y demuestra que lo recuerdas ("la última vez me comentaste que..."). NUNCA recites esta lista literalmente.`
        : "";

    // ── Fase 2: resumen de la conversación previa (capa media) ──
    const summaryBlock = conversationSummary
        ? `\n\n═══ RESUMEN DE LA CONVERSACIÓN PREVIA ═══
${conversationSummary}
(Los mensajes más recientes vienen a continuación en el historial. Este resumen cubre lo anterior.)`
        : "";

    // The tenant's custom prompt is the core; we inject everything around it
    return `${tenantSystemPrompt}${toneBlock}${escalationBlock}${stagesBlock}${catalogBlock}${knowledgeBlock}${faqBlock}${retrievedBlock}${memoryBlock}${summaryBlock}

═══ FECHA Y HORA ACTUAL ═══
📅 Hoy es: ${chileDate}
⏰ Hora actual (Chile): ${chileTime}
🗓️ Timestamp completo: ${chileFull}
USA ESTA FECHA COMO REFERENCIA ABSOLUTA para cualquier cálculo de fechas.

═══ REGLAS DE MANEJO DE FECHAS ═══
⚠️ Si el cliente menciona un día relativo ("mañana", "el próximo lunes", "pasado mañana", "esta semana", "el viernes"), DEBES:
1. Calcular la fecha EXACTA basándote en la fecha actual de arriba.
2. CONFIRMAR la fecha exacta con el cliente ANTES de llamar a la herramienta. Ejemplo: "¿Te parece bien el lunes 24 de febrero a las 11:00?"
3. SOLO llama a gestionar_lead_crm DESPUÉS de que el cliente confirme la fecha exacta.
4. NUNCA uses años anteriores al actual. El año actual es ${now.getFullYear()}.

═══ REGLAS DE FORMATO DE RESPUESTA ═══
⚠️ PROHIBICIÓN ABSOLUTA: BAJO NINGUNA CIRCUNSTANCIA debes escribir JSON, código, llaves {}, corchetes [], ni estructuras de programación en tus respuestas de texto.
⚠️ Si necesitas agendar, descartar o derivar un prospecto, UTILIZA LA HERRAMIENTA gestionar_lead_crm de forma nativa (tool_calls). NUNCA escribas los argumentos de la herramienta en el chat.
⚠️ Tus respuestas deben ser EXCLUSIVAMENTE texto conversacional en español, como si hablaras por WhatsApp con un cliente.

═══ OBLIGACIÓN DE USO DE HERRAMIENTA ═══
🚨 OBLIGATORIO: Ya sea para marcar interés (Interesado), agendar (Calificado), descartar (Descartado) o derivar a humano (Derivado a Humano), NUNCA te despidas sin usar la herramienta gestionar_lead_crm.
Si omites la herramienta, el sistema fallará y el cliente se perderá del CRM.
SIEMPRE llama a la función ANTES de tu mensaje de despedida.

═══ MÁQUINA DE ESTADOS — TRANSICIONES PERMITIDAS ═══
El pipeline de ventas funciona como una máquina de estados. Respeta estas reglas de transición:
📊 FLUJO NORMAL: Nuevo Lead → Interesado → Visita Agendada → Cierre/Venta
🔄 TRANSICIONES VÁLIDAS PARA TI (IA):
  - Nuevo Lead → Interesado (cuando el cliente muestra interés activo)
  - Interesado → Calificado/Visita Agendada (cuando confirma día Y hora)
  - Cualquier etapa → Descartado (SOLO con rechazo explícito)
  - Cualquier etapa → Derivado a Humano (cuando se cumple la regla de escalación)
⚠️ NUNCA saltes etapas sin razón. Si un lead nuevo agenda directamente, puedes ir de Nuevo → Calificado.
⚠️ NUNCA retrocedas una etapa (de Visita Agendada a Interesado, por ejemplo) — solo los humanos pueden hacer eso.

═══ IMPORTANTE ═══
- El resumen_conversacion debe incluir los datos clave extraídos: presupuesto mencionado, interés principal, motivo de derivación si aplica.
- REPITO: NO escribas JSON en tus mensajes. Usa SOLO la herramienta.

═══ REGLAS SUPREMAS DE CONVERSACIÓN Y SISTEMA (INQUEBRANTABLES) ═══
ESTILO DE COMUNICACIÓN (CERO INTERROGATORIOS):
- ESTÁ ESTRICTAMENTE PROHIBIDO enviar listas numeradas o hacer más de UNA pregunta a la vez.
- La conversación debe ser fluida, cálida y humana. Haz una pregunta, espera la respuesta del cliente, reacciona con empatía y luego haz la siguiente pregunta.

OBTENCIÓN DEL NOMBRE:
- Si no tienes el nombre del cliente, debes averiguarlo de forma sutil en el primer o segundo mensaje (ej. "Por cierto, ¿con quién tengo el gusto?" o "Para atenderte mejor, ¿me podrías indicar tu nombre?"). Esto es obligatorio.

🛑 BARRERA DE IDENTIFICACIÓN — HARD BLOCK UNIVERSAL (TODAS LAS INDUSTRIAS, INQUEBRANTABLE) 🛑
🚨 REGLA ABSOLUTA: Es IMPOSIBLE ejecutar gestionar_lead_crm, agendar una cita, tomar un pedido (delivery/retiro) o mover al cliente a cualquier etapa de tipo «Agendado» / «Visita Agendada» / «Cita Agendada» sin tener el NOMBRE REAL del cliente, dicho por él mismo en esta conversación activa.
❌ Si el cliente acepta agendar o confirma hora, y aún NO conoces su nombre real, tu ÚNICA respuesta permitida en ese turno es pedirlo. EJEMPLO OBLIGATORIO:
"¡Perfecto! El viernes a las 11:00 está disponible. Para dejar la cita registrada a tu nombre, ¿me podrías indicar tu nombre y apellido?"
❌ NO importa si el número ya existía en el CRM: si el nombre guardado es 'Cliente', 'Lead WhatsApp', nulo o cualquier valor genérico, se considera que NO tienes el nombre y DEBES pedirlo.
✅ SOLO puedes llamar a gestionar_lead_crm cuando el usuario haya escrito su nombre explícitamente en esta conversación activa.
Esta regla aplica para TODAS las plantillas sin excepción: Inmobiliaria, E-commerce, Peluquería, Dental, y cualquier otra industria.

SILENCIO ABSOLUTO SOBRE HERRAMIENTAS Y ESTADOS:
- NUNCA menciones que actualizaste el sistema, cambiaste una etapa, o usaste una herramienta.
- PROHIBIDO usar frases como "He registrado tu solicitud como...", "Actualicé el sistema" o mencionar nombres de etapas internos.
- Si debes derivar a un asesor, simplemente di: "Comprendo. Le pediré a uno de nuestros asesores que se contacte contigo a la brevedad para ayudarte personalmente." Ejecuta la herramienta de cambio de etapa en total silencio.

ACTUALIZACIÓN DEL PIPELINE (CRM) — MÁQUINA DE ESTADOS:
- Tienes la obligación de mantener actualizado el estado del cliente en el embudo de ventas.
- Si el cliente muestra interés activo (pregunta precios, solicita info, compara opciones), llama a gestionar_lead_crm con estado_filtro="Interesado" para moverlo a la etapa de interesado.
- Si el cliente agenda una reunión o acepta que lo contacte un asesor, DEBES usar la herramienta con estado_filtro="Calificado" para moverlo a la etapa de visita/reunión. NO lo dejes en la primera etapa.
- REGLA DE PROGRESIÓN: Un lead debe avanzar siempre hacia adelante en el pipeline. Nunca retrocedas a un lead (de "Visita Agendada" a "Interesado", por ejemplo).
- Usa los nombres EXACTOS de las etapas listadas en la sección ETAPAS DEL PIPELINE DE VENTAS de arriba.

═══ EJECUCIÓN DE HERRAMIENTAS — SINCRONÍA TEXTO-ACCIÓN (INQUEBRANTABLE) ═══
🚨 REGLA ABSOLUTA: Lo que dices en el chat y lo que ejecutas en el CRM DEBEN ser idénticos. Si en tu respuesta de texto confirmas o implicas que se ha agendado una cita, DEBES invocar OBLIGATORIAMENTE en ese mismo turno la herramienta gestionar_lead_crm con estado_filtro="Calificado" y mover al lead a la etapa de visita/cita del pipeline.
🚫 PROHIBIDO: Decir frases equivalentes a "¡Tu cita está agendada!" o "Tu visita quedó confirmada para el [fecha]" sin que en ese mismo turno hayas llamado a la herramienta. El sistema detecta esta inconsistencia. Si el texto dice «agendado» pero no hay tool call, es un error crítico que deja el lead abandonado en la primera etapa del CRM.
✅ CORRECTO: Cliente confirma día y hora → inmediatamente en ese turno llamas a gestionar_lead_crm(estado_filtro="Calificado", fecha_hora_cita="...") → luego envías el mensaje de confirmación al cliente.
❌ INCORRECTO: Enviar el mensaje de confirmación sin haber llamado a la herramienta en ese mismo turno.

═══ REGLA ESTRICTA DE ESTADOS — PROHIBICIÓN DE "DESCARTADO" PREMATURO ═══
🚫 NUNCA uses estado_filtro="Descartado" en ninguno de estos escenarios:
  - El cliente está agendando o acaba de agendar una cita.
  - El cliente está pensando, pidiendo tiempo, o comparando opciones.
  - El cliente no ha respondido aún o tardó en responder.
  - La conversación terminó de forma neutral o positiva.
  - El cliente mostró incluso mínimo interés.
✅ SOLO usa estado_filtro="Descartado" cuando el cliente EXPLÍCITAMENTE diga: "No me interesa", "Ya encontré otro", "No quiero saber nada", te insulte, o rechace de forma definitiva y clara toda posibilidad de continuar. Un cliente que agenda una visita es, por definición, el caso MÁS OPUESTO a un lead Descartado.

═══════════════════════════════════════════════════════════════
📅 REGLA DE FECHAS — HARD BLOCK UNIVERSAL (TODAS LAS INDUSTRIAS)
═══════════════════════════════════════════════════════════════
Tienes la fecha y hora actuales en tu contexto (ver sección FECHA Y HORA ACTUAL arriba).
🚫 PROHIBICIÓN ABSOLUTA: NUNCA adivines ni supongas el día de la semana para una fecha dada.
✅ CÓMO OPERAR:
  1. Si el cliente menciona un día de la semana (ej. "el viernes"), calcula cuál es la fecha exacta (número de día y mes) a partir de HOY, y confírmala antes de agendar.
  2. Si el cliente menciona una fecha (ej. "el 5 de marzo"), calcula cuál es el día de la semana EXACTO para esa fecha y confírmalo antes de agendar.
  3. NUNCA digas cosas como "el miércoles 5" si el 5 es jueves — eso es un error crítico que destruye la confianza del cliente.
  4. SIEMPRE confirma: "¿Te parece bien el [día calculado correctamente] [fecha] a las [hora]?" antes de llamar a gestionar_lead_crm.
  5. NUNCA uses años anteriores al año actual (${now.getFullYear()}).
Esta regla es INQUEBRANTABLE para TODAS las plantillas de industria.

═══════════════════════════════════════════════════════════════
🛑 REGLA DE INVENTARIO — ANTI-ALUCINACIÓN (HARD BLOCK UNIVERSAL)
═══════════════════════════════════════════════════════════════
Tu ÚNICA fuente de verdad de productos, servicios o propiedades es la sección [CATÁLOGO/INVENTARIO] de este prompt.
🚫 TIENES ESTRICTAMENTE PROHIBIDO:
  - Inventar, suponer o mencionar productos, propiedades, servicios, precios o características que NO aparezcan explícitamente en el catálogo.
  - Ofrecer alternativas genéricas cuando el catálogo no tiene lo que busca el cliente.
  - Decir "tenemos algo similar" si no aparece en el catálogo.
✅ SI EL CATÁLOGO ESTÁ VACÍO O NO TIENE LO QUE BUSCA EL CLIENTE:
  - Informa al cliente con honestidad que en este momento no cuentas con ese producto/propiedad/servicio.
  - Ofréce derivarlo a un asesor humano o quedar en avisarle cuando haya disponibilidad.
  - Ejecuta gestionar_lead_crm con estado_filtro="Derivado a Humano" si aplica.
Esta regla es INQUEBRANTABLE para TODAS las plantillas de industria.

═══════════════════════════════════════════════════════════════
🔄 REGLA DE REPROGRAMACIÓN — HARD BLOCK UNIVERSAL
═══════════════════════════════════════════════════════════════
Si un cliente pide cambiar la fecha u hora de una cita ya agendada, esto es un indicador de ALTO INTERÉS en el servicio.
🚫 NUNCA, BAJO NINGUNA CIRCUNSTANCIA debes:
  - Cambiar el estado del lead a "Descartado" al reprogramar.
  - Interpretar una solicitud de cambio de fecha como un rechazo o pérdida de interés.
✅ AL REPROGRAMAR DEBES:
  1. Confirmar la nueva fecha y hora con el cliente (aplicando la REGLA DE FECHAS).
  2. Llamar a gestionar_lead_crm con estado_filtro="Calificado" y la nueva fecha_hora_cita.
  3. Mantener o mejorar la etapa del lead en el pipeline (nunca retrocederla a "Descartado").
Esta regla es INQUEBRANTABLE para TODAS las plantillas de industria.`;
}

void isAppointmentCriticalIndustry; // imported for potential future use in prompt logic

// ═══════════════════════════════════════════════════════════════
//  🛡️ GUARDRAIL — Clean leaked JSON from AI response
// ═══════════════════════════════════════════════════════════════
function sanitizeBotResponse(text: string): string {
    if (!text)
        return "¡Gracias por tu interés! Un asesor se pondrá en contacto contigo.";
    let cleaned = text;
    cleaned = cleaned.replace(/```json[\s\S]*?```/gi, "");
    cleaned = cleaned.replace(/```[\s\S]*?```/gi, "");
    cleaned = cleaned.replace(/\{\s*"[^"]+"\s*:[\s\S]*?\}/g, "");
    cleaned = cleaned.replace(/gestionar_lead_crm\s*\([^)]*\)/gi, "");
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
    if (cleaned.length < 5) {
        return "¡Gracias por tu interés! Un asesor se pondrá en contacto contigo.";
    }
    return cleaned;
}

// ═══════════════════════════════════════════════════════════════
//  🧹 SANITIZE MESSAGE HISTORY — Ensure valid tool call pairing
// ═══════════════════════════════════════════════════════════════
function sanitizeMessageHistory(
    messages: ChatCompletionMessageParam[]
): ChatCompletionMessageParam[] {
    // ── Phase 1: Deep-copy & normalize tool_calls from DB JSON strings ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any[] = messages.map((m) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = { ...m } as any;
        if (msg.role === "assistant" && msg.tool_calls) {
            if (typeof msg.tool_calls === "string") {
                try {
                    msg.tool_calls = JSON.parse(msg.tool_calls);
                } catch {
                    delete msg.tool_calls;
                }
            }
            if (Array.isArray(msg.tool_calls)) {
                msg.tool_calls = msg.tool_calls
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((tc: any) => {
                        if (typeof tc === "string") {
                            try { return JSON.parse(tc); } catch { return null; }
                        }
                        if (tc && tc.function && typeof tc.function.arguments !== "string") {
                            tc.function.arguments = JSON.stringify(tc.function.arguments);
                        }
                        return tc;
                    })
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .filter((tc: any) => tc !== null && tc.id);

                if (msg.tool_calls.length === 0) {
                    delete msg.tool_calls;
                }
            }
        }
        return msg;
    });

    // ── Phase 2: Catalogue which tool_call IDs have a matching tool-response ──
    const respondedToolCallIds = new Set<string>();
    for (const m of parsed) {
        if (m.role === "tool" && m.tool_call_id) {
            respondedToolCallIds.add(m.tool_call_id);
        }
    }

    // ── Phase 3: Identify assistant messages whose tool_calls are fully responded ──
    const validToolCallIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incompleteAssistants = new WeakSet<any>();
    for (const m of parsed) {
        if (
            m.role === "assistant" &&
            Array.isArray(m.tool_calls) &&
            m.tool_calls.length > 0
        ) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allResponded = m.tool_calls.every((tc: any) =>
                tc.id && respondedToolCallIds.has(tc.id)
            );
            if (allResponded) {
                for (const tc of m.tool_calls) validToolCallIds.add(tc.id);
            } else {
                incompleteAssistants.add(m);
                console.warn(`🧹 Stripping tool_calls from assistant with missing tool responses`);
            }
        }
    }

    // ── Phase 4: Build clean history, removing orphaned tool msgs ──
    const sanitized: ChatCompletionMessageParam[] = [];
    for (let i = 0; i < parsed.length; i++) {
        const m = parsed[i];

        if (incompleteAssistants.has(m)) {
            const { tool_calls: _dropped, ...rest } = m;
            void _dropped;
            if (rest.content) sanitized.push(rest);
            continue;
        }

        if (m.role === "tool") {
            const toolCallId = m.tool_call_id;
            if (!toolCallId || !validToolCallIds.has(toolCallId)) {
                console.warn(`🧹 Removing orphaned tool message (tool_call_id: ${toolCallId})`);
                continue;
            }
            let foundPrecedingAssistant = false;
            for (let j = sanitized.length - 1; j >= 0; j--) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const prev = sanitized[j] as any;
                if (
                    prev.role === "assistant" &&
                    Array.isArray(prev.tool_calls) &&
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    prev.tool_calls.some((tc: any) => tc.id === toolCallId)
                ) {
                    foundPrecedingAssistant = true;
                    break;
                }
            }
            if (!foundPrecedingAssistant) {
                console.warn(`🧹 Removing tool message with no preceding assistant (tool_call_id: ${toolCallId})`);
                continue;
            }
        }

        sanitized.push(m);
    }

    return sanitized as ChatCompletionMessageParam[];
}

// ═══════════════════════════════════════════════════════════════
//  📚 LOAD CONVERSATION HISTORY FROM SUPABASE
//
//  Replaces the former in-memory `chatMemory` Map.
//  By reading from `lead_messages` on every request this works
//  correctly across Vercel serverless cold starts and across
//  multiple concurrent function instances.
// ═══════════════════════════════════════════════════════════════
async function loadConversationHistory(
    leadId: string,
    limit = 15
): Promise<ChatCompletionMessageParam[]> {
    // Fetch the MOST RECENT `limit` rows (descending), then reverse
    // to chronological order. Ascending+limit would return the oldest
    // messages and freeze the bot's context on long conversations.
    const { data, error } = await supabaseAdmin
        .from("lead_messages")
        .select("role, content")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error || !data) return [];

    // Only user/assistant turns — tool call rows are ephemeral within a
    // single request and are not stored in lead_messages.
    return data
        .reverse()
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
        }));
}

// ═══════════════════════════════════════════════════════════════
//  Tenant type for clarity
// ═══════════════════════════════════════════════════════════════
interface TenantConfig {
    id: string;
    name: string;
    openai_api_key: string;
    whatsapp_provider: "twilio" | "meta";
    whatsapp_credentials: Record<string, string>;
}

// ═══════════════════════════════════════════════════════════════
//  🏗️ FIRST STAGE — leads.stage_id is NOT NULL, so a tenant
//  without pipeline stages needs one created on the fly.
// ═══════════════════════════════════════════════════════════════
export async function getOrCreateFirstStage(orgId: string): Promise<string | null> {
    const { data: firstStage } = await supabaseAdmin
        .from("pipeline_stages")
        .select("id")
        .eq("organization_id", orgId)
        .order("position", { ascending: true })
        .limit(1);

    if (firstStage && firstStage.length > 0) return firstStage[0].id;

    const { data: created, error } = await supabaseAdmin
        .from("pipeline_stages")
        .insert({ organization_id: orgId, name: "Nuevo Lead", position: 0 })
        .select("id")
        .single();

    if (error) {
        console.error(`❌ No se pudo crear etapa inicial para org ${orgId}:`, error.message);
        return null;
    }
    return created.id;
}

// ═══════════════════════════════════════════════════════════════
//  processLeadTurn — procesa UN turno de conversación (posiblemente
//  una ráfaga de varios mensajes ya unidos en combinedText).
//  Invocado por: el timer de debounce del webhook, el sweeper del
//  cron, o inline como fallback si la tabla de cola no existe.
// ═══════════════════════════════════════════════════════════════

export interface ProcessTurnParams {
    orgId: string;
    /** Teléfono normalizado (sin 'whatsapp:' ni '+') */
    phone: string;
    leadId?: string | null;
    /** Texto del turno — la ráfaga completa unida con saltos de línea */
    combinedText: string;
    /** true → envía la respuesta por WhatsApp (flujo asíncrono/cola);
     *  false → solo la devuelve (fallback inline: la ruta responde TwiML) */
    sendReply: boolean;
    /** created_at del último mensaje del cliente — para medir la
     *  latencia PERCIBIDA (incluye la ventana de debounce) */
    lastUserMessageAt?: string;
    /** cuántos mensajes de la ráfaga componen este turno */
    batchMessageCount?: number;
}

export interface ProcessTurnResult {
    botResponse: string | null;
}

export async function processLeadTurn(
    params: ProcessTurnParams
): Promise<ProcessTurnResult> {
    const { orgId: tenantId, phone: phoneClean, combinedText: incomingMsg, sendReply } = params;

    try {
        // ── 1. Load tenant config ─────────────────────────────
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from("organizations")
            .select(
                "id, name, openai_api_key, whatsapp_provider, whatsapp_credentials, settings, plan"
            )
            .eq("id", tenantId)
            .single();

        if (tenantError || !tenant) {
            console.error(`❌ [Processor] Tenant not found: ${tenantId}`);
            return { botResponse: null };
        }

        const t = tenant as TenantConfig;

        if (!t.openai_api_key) {
            console.error(`❌ [Processor] Tenant ${t.name} has no OpenAI API key`);
            return { botResponse: null };
        }

        console.log(`🧠 [${t.name}] Procesando turno de ${phoneClean}: ${incomingMsg.slice(0, 120)}`);

        // ── 3. Load agent config ──────────────────────────────
        const { data: agent } = await supabaseAdmin
            .from("agents")
            .select("system_prompt, booking_url, conversation_tone, escalation_rule")
            .eq("organization_id", tenantId)
            .eq("is_active", true)
            .limit(1)
            .single();

        const basePrompt =
            agent?.system_prompt ||
            "Eres un asistente de ventas profesional. Filtra prospectos haciendo preguntas clave sobre qué buscan, su presupuesto y zona de interés.";

        let fullPrompt = basePrompt;
        if (agent?.booking_url) {
            fullPrompt += `\n\n═══ ENLACE DE AGENDAMIENTO ═══\nCuando el prospecto califique, entrégale este link para agendar: ${agent.booking_url}`;
        }

        // ── 4. Resolve lead + re-check bot pause ──────────────
        // El lead ya fue creado (y su mensaje persistido) por el
        // webhook al recibirlo. La pausa se re-verifica AQUÍ, después
        // del debounce: pudo activarse durante la ventana (p. ej. un
        // humano tomó el chat o hubo un handoff en el lote anterior).
        let leadId: string | null = params.leadId ?? null;
        let isBotPaused = false;
        let conversationSummary: string | null = null;

        // Nota: conversation_summary puede no existir aún (migración
        // Fase 2 pendiente) — el select con columna faltante falla,
        // por eso se pide en una consulta separada tolerante.
        if (leadId) {
            const { data: leadRow } = await supabaseAdmin
                .from("leads")
                .select("id, is_bot_paused")
                .eq("id", leadId)
                .maybeSingle();
            isBotPaused = !!leadRow?.is_bot_paused;
        } else {
            const { data: leadRow } = await supabaseAdmin
                .from("leads")
                .select("id, is_bot_paused")
                .eq("organization_id", tenantId)
                .eq("phone", phoneClean)
                .limit(1)
                .maybeSingle();
            leadId = leadRow?.id ?? null;
            isBotPaused = !!leadRow?.is_bot_paused;
        }

        if (leadId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: summaryRow } = await (supabaseAdmin as any)
                .from("leads")
                .select("conversation_summary")
                .eq("id", leadId)
                .maybeSingle();
            conversationSummary = summaryRow?.conversation_summary ?? null;
        }

        if (isBotPaused) {
            console.log(`⏸️ [${t.name}] Bot pausado para ${phoneClean}. Turno descartado.`);
            return { botResponse: null };
        }

        // ── 4b'. 💳 Presupuesto IA del plan (Billing) ─────────
        // Al 100% del cap mensual de tokens el bot se congela con
        // un mensaje fijo (sin costo LLM) y alerta in-app 1/día.
        const budget = await checkAiBudget(tenantId);
        if (!budget.allowed) {
            console.warn(`💳 [${t.name}] Presupuesto IA agotado (${budget.used}/${budget.limit} tokens, plan ${budget.plan})`);

            const since = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
            const { data: recentNotif } = await supabaseAdmin
                .from("notifications")
                .select("id")
                .eq("tenant_id", tenantId)
                .eq("type", "billing")
                .gte("created_at", since)
                .limit(1);
            if (!recentNotif || recentNotif.length === 0) {
                await supabaseAdmin.from("notifications").insert({
                    tenant_id: tenantId,
                    type: "billing",
                    message: `⚠️ Tu agente alcanzó el límite mensual de IA del plan ${budget.plan.toUpperCase()} y dejó de responder. Mejora tu plan en Configuración → Plan.`,
                });
            }

            const frozenMsg =
                "Gracias por escribirnos 🙏 En este momento no puedo responder automáticamente, " +
                "pero una persona de nuestro equipo revisará tu mensaje a la brevedad.";
            if (sendReply && leadId) {
                await sendWhatsAppMessage(tenantId, phoneClean, frozenMsg);
                await supabaseAdmin.from("lead_messages").insert({
                    lead_id: leadId, role: "assistant", content: frozenMsg,
                });
            }
            return { botResponse: frozenMsg };
        }

        // ── 4d. Load full conversation history from Supabase ──
        // The last 15 rows include the message just saved above,
        // so dbHistory ends with the current user message — ready
        // to be passed directly to OpenAI without any extra push.
        const dbHistory: ChatCompletionMessageParam[] = leadId
            ? await loadConversationHistory(leadId, 15)
            : [{ role: "user", content: incomingMsg }];

        // ── 4e. Compute and persist live chat status ──────────
        const userMsgCount = dbHistory.filter((m) => m.role === "user").length;
        const liveChatStatus =
            userMsgCount <= 1
                ? "Contacto inicial"
                : userMsgCount <= 3
                    ? "Consultando opciones"
                    : "Filtrando perfil";

        if (leadId) {
            await supabaseAdmin
                .from("leads")
                .update({ chat_status: liveChatStatus })
                .eq("id", leadId);
        }

        // ── 5. Fetch pipeline stages + catalog + knowledge ────
        const { data: stageDocs } = await supabaseAdmin
            .from("pipeline_stages")
            .select("name")
            .eq("organization_id", tenantId)
            .order("position", { ascending: true });
        const pipelineStageNames: string[] = (stageDocs || []).map(
            (s: { name: string }) => s.name
        );

        const [{ data: catalogItems }, { data: agentWithContext }] = await Promise.all([
            supabaseAdmin
                .from("products")
                .select("name, description, attributes")
                .eq("organization_id", tenantId)
                .eq("status", "active")
                .order("created_at", { ascending: true }),
            supabaseAdmin
                .from("agents")
                .select("scraped_context")
                .eq("organization_id", tenantId)
                .limit(1)
                .maybeSingle(),
        ]);

        const tenantOpenai = new OpenAI({ apiKey: t.openai_api_key });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formatCatalogItems = (items: any[]): string =>
            items.map((item, idx) => {
                const attrs = item.attributes || {};
                const attrsStr = Object.entries(attrs)
                    .map(([k, v]) => `  • ${k}: ${v}`)
                    .join("\n");
                return `${idx + 1}. ${item.name}${item.description ? " — " + item.description : ""}${attrsStr ? "\n" + attrsStr : ""}`;
            }).join("\n\n");

        // RAG threshold: with small catalogs the full listing is cheap
        // and more reliable; above this size we pre-filter by semantic
        // similarity (pgvector) to keep the prompt lean.
        const RAG_CATALOG_THRESHOLD = 20;

        // ── Fase 2: UN solo embedding por turno, compartido entre
        // el RAG de catálogo y el de conocimiento (FAQs/scraping) ──
        const largeCatalog = !!(catalogItems && catalogItems.length > RAG_CATALOG_THRESHOLD);
        const hasKnowledgeIndex = await orgHasKnowledgeIndex(tenantId);

        let turnEmbedding: number[] | null = null;
        if (largeCatalog || hasKnowledgeIndex) {
            try {
                const embRes = await tenantOpenai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: incomingMsg.slice(0, 2000),
                });
                logOpenAiCompletionUsage(tenantId, leadId, "text-embedding-3-small", "embedding", embRes.usage);
                turnEmbedding = embRes.data[0].embedding;
            } catch (embErr) {
                console.warn(`⚠️ [${t.name}] Embedding del turno falló — RAG desactivado para este mensaje:`, embErr);
            }
        }

        // ── Catálogo: completo si es chico; top-12 semántico si es grande ──
        let catalogText: string;
        if (!catalogItems || catalogItems.length === 0) {
            catalogText =
                "[CATÁLOGO ACTUAL: Vacío. No tienes productos, propiedades ni servicios para ofrecer en este momento. " +
                "Si el cliente te solicita algo, debes informarle con amabilidad que no hay disponibilidad actualmente " +
                "y ofrecerte a avisarle cuando haya novedades. NUNCA inventes ni ofrezcas algo que no exista aquí.]";
        } else if (largeCatalog && turnEmbedding) {
            catalogText = formatCatalogItems(catalogItems); // fallback: full catalog
            try {
                const { data: matches } = await supabaseAdmin.rpc("match_products", {
                    query_embedding: JSON.stringify(turnEmbedding),
                    match_org_id: tenantId,
                    match_threshold: 0.25,
                    match_count: 12,
                });
                if (matches && matches.length > 0) {
                    catalogText =
                        `[Mostrando los ${matches.length} productos MÁS RELEVANTES para la consulta actual, ` +
                        `de un catálogo total de ${catalogItems.length}. Si el cliente pregunta por algo que no ves aquí, ` +
                        `dile que consultarás disponibilidad y deriva a un asesor humano si es necesario.]\n\n` +
                        formatCatalogItems(matches);
                }
            } catch (ragErr) {
                console.warn(`⚠️ [${t.name}] RAG de catálogo falló, usando catálogo completo:`, ragErr);
            }
        } else {
            catalogText = formatCatalogItems(catalogItems);
        }

        // ── Conocimiento (FAQs + scraping): RAG si hay índice;
        // si no, modo legacy (inyección completa) ──
        let retrievedKnowledge: string | null = null;
        if (hasKnowledgeIndex && turnEmbedding) {
            const chunks = await retrieveKnowledge(tenantId, turnEmbedding, 6);
            if (chunks && chunks.length > 0) {
                retrievedKnowledge = chunks
                    .map((c, i) => `${i + 1}. [${c.source_type === "faq" ? "FAQ oficial" : "Info de la empresa"}] ${c.content}`)
                    .join("\n\n");
            } else if (chunks) {
                // Índice existe pero nada relevante para este turno —
                // no inyectar nada (el prompt ya instruye no inventar)
                retrievedKnowledge = "(Ningún fragmento supera el umbral de relevancia para esta consulta. Si el cliente pregunta algo específico del negocio que no sepas, ofrece derivar a un asesor.)";
            }
        }

        const scrapedContext: string | null =
            retrievedKnowledge !== null ? null : (agentWithContext?.scraped_context ?? null);

        // ── Fase 2: memoria de largo plazo del lead ──
        const memoryFacts: string[] = leadId
            ? (await getLeadFacts(leadId)).map((f) => f.fact)
            : [];

        // ── 6. Build system prompt and call OpenAI ────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tenantSettings = (tenant as any)?.settings || {};
        const industryId: string | null = tenantSettings.industry_template ?? null;
        // Con RAG activo, las FAQs completas NO van al prompt — los
        // fragmentos relevantes ya vienen en retrievedKnowledge.
        const faqEntries: FaqEntry[] | null =
            retrievedKnowledge !== null ? null : (tenantSettings.faqs ?? null);
        let systemPrompt = buildSystemPrompt(
            fullPrompt,
            agent?.conversation_tone,
            agent?.escalation_rule,
            pipelineStageNames,
            catalogText,
            scrapedContext,
            industryId,
            faqEntries,
            conversationSummary,
            memoryFacts,
            retrievedKnowledge
        );

        // ── 🛡️ Modo Guardián (Starter): autonomía alta org-level.
        // Gated por plan + toggle en settings. En guardián el bot
        // resuelve todo lo posible y deriva SOLO emergencias reales.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const guardianMode: boolean =
            tenantSettings.autonomy_mode === "guardian" &&
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            !!getPlanLimits((tenant as any)?.plan).guardian_mode;

        if (guardianMode) {
            systemPrompt += `

═══ 🛡️ MODO GUARDIÁN ACTIVO (autonomía máxima) ═══
El dueño del negocio está desconectado y confía en ti para operar solo.
- Resuelve TODO lo que puedas con el catálogo, FAQs y herramientas disponibles. Agenda, cotiza y confirma sin esperar aprobación.
- Deriva a humano ÚNICAMENTE ante emergencias reales (reclamo grave, urgencia médica/legal, cliente muy molesto). Ante la duda, resuélvelo tú.
- Si algo no está en tu información, toma nota del pedido, dile al cliente que quedó registrado para mañana, y continúa — NUNCA cortes la conversación.`;
        }

        // ── 6a. Load appointment config & inject appointment prompt ──
        const appointmentConfig = await getAppointmentConfig(tenantId);
        const hasAppointmentConfig = !!(tenantSettings?.appointment_config);

        if (hasAppointmentConfig) {
            const hours = await getBusinessHours(tenantId);
            const hoursText = businessHoursToText(hours);
            const rescheduleText = appointmentConfig.reschedule_policy === "self_service"
                ? "El cliente PUEDE cancelar y reprogramar su cita directamente por este chat."
                : "El cliente puede cancelar por este chat, pero para REPROGRAMAR debe hablar con un asesor humano.";

            systemPrompt += `\n\n═══ SISTEMA DE CITAS ═══
TIENES ACCESO A UN SISTEMA DE AGENDAMIENTO con 3 herramientas:
1. verificar_disponibilidad — SIEMPRE verifica antes de ofrecer un horario
2. agendar_cita — Crea la cita SOLO después de confirmación explícita del cliente
3. gestionar_cita_existente — Para cancelar o reprogramar citas

FLUJO OBLIGATORIO:
1. Cliente muestra interés → usa verificar_disponibilidad
2. Ofrece 2-3 horarios disponibles
3. Cliente elige → confirma fecha + hora + servicio
4. Usa agendar_cita (esto actualiza el CRM automáticamente)

REGLAS DE REPROGRAMACIÓN:
${rescheduleText}

HORARIO DE ATENCIÓN:
${hoursText}
`;
        }

        const dynamicTools = buildToolsForOrg(hasAppointmentConfig);

        // `currentTurnMessages` is the ephemeral working array for this
        // single request. It starts with the persisted DB history and
        // grows with tool_call / tool-response pairs that are NOT saved
        // to Supabase — only the final assistant text response is persisted.
        const currentTurnMessages: ChatCompletionMessageParam[] = [...dbHistory];

        const completion = await tenantOpenai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                ...sanitizeMessageHistory(currentTurnMessages),
            ],
            tools: dynamicTools,
            tool_choice: "auto",
        });

        // 📊 Telemetría de costos por tenant
        logOpenAiCompletionUsage(tenantId, leadId, "gpt-4o-mini", "chat", completion.usage);

        const assistantMsg = completion.choices[0].message;
        let botResponse = assistantMsg.content || "";

        // ── 7. Handle tool calls ──────────────────────────────
        if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
            // Append the assistant turn (with tool_calls) to the ephemeral array
            currentTurnMessages.push(assistantMsg);

            for (const toolCall of assistantMsg.tool_calls) {
                if (toolCall.type !== "function") continue;
                if (toolCall.function.name === "gestionar_lead_crm") {
                    const rawArgs = JSON.parse(toolCall.function.arguments);

                    // ── 🛡️ ZOD VALIDATION ────────────────────────
                    const validation = CRMToolArgsSchema.safeParse(rawArgs);
                    if (!validation.success) {
                        const errorMessages = validation.error.issues.map(i => i.message).join("; ");
                        console.error(`🛡️ [${t.name}] Zod validation failed: ${errorMessages}`);
                        console.error(`🛡️ Raw args:`, JSON.stringify(rawArgs));

                        // Return error to AI so it can self-correct
                        currentTurnMessages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({
                                success: false,
                                error: `Validación fallida: ${errorMessages}. Corrige los datos e intenta de nuevo.`,
                            }),
                        });
                        continue; // Skip to next tool call or follow-up
                    }

                    const {
                        nombre_cliente,
                        estado_filtro,
                        fecha_hora_cita,
                        resumen_conversacion,
                        temperatura,
                    } = validation.data;

                    console.log(`🔧 [${t.name}] Tool call: ${estado_filtro} — ${nombre_cliente}${temperatura ? ` [${temperatura}]` : ""}`);

                    // ── Find target stage (State Machine Logic) ────
                    // Load ALL stages for intelligent matching
                    const { data: allStages } = await supabaseAdmin
                        .from("pipeline_stages")
                        .select("id, name, position")
                        .eq("organization_id", tenantId)
                        .order("position", { ascending: true });

                    let targetStageId: string | undefined;
                    let targetStageLabel = "";

                    if (allStages && allStages.length > 0) {
                        // Smart stage matching based on estado_filtro
                        const stageMap: Record<string, string[]> = {
                            "Interesado": ["interes", "contacto", "consulta"],
                            "Calificado": ["isita", "agend", "calific", "cita", "reuni"],
                            "Descartado": ["escart", "perdid", "cancel", "cerrado"],
                            "Derivado a Humano": ["deriv", "human", "escala"],
                        };

                        const searchTerms = stageMap[estado_filtro] || [];
                        for (const term of searchTerms) {
                            const match = allStages.find(s => s.name.toLowerCase().includes(term));
                            if (match) {
                                targetStageId = match.id;
                                targetStageLabel = match.name;
                                break;
                            }
                        }

                        // Fallback by position if no name match
                        if (!targetStageId) {
                            if (estado_filtro === "Interesado" && allStages.length >= 2) {
                                // 2nd stage (after "Nuevo Lead")
                                targetStageId = allStages[1].id;
                                targetStageLabel = allStages[1].name;
                            } else if (estado_filtro === "Calificado" && allStages.length >= 3) {
                                // 3rd stage (Visita Agendada position)
                                targetStageId = allStages[2].id;
                                targetStageLabel = allStages[2].name;
                            } else if (estado_filtro === "Derivado a Humano" && allStages.length >= 2) {
                                targetStageId = allStages[1].id;
                                targetStageLabel = allStages[1].name;
                            } else {
                                // Ultimate fallback: first stage
                                targetStageId = allStages[0].id;
                                targetStageLabel = allStages[0].name;
                            }
                        }
                    }

                    // ── Upsert lead with CRM data ──────────────────
                    const { data: existingLeads } = await supabaseAdmin
                        .from("leads")
                        .select("id, stage_id")
                        .eq("organization_id", tenantId)
                        .eq("phone", phoneClean)
                        .limit(1);

                    const currentLeadId = existingLeads?.[0]?.id || null;
                    const currentStageId = existingLeads?.[0]?.stage_id || null;

                    // ── 🔄 VALIDATE STAGE TRANSITION ──────────────
                    if (targetStageId && currentLeadId && currentStageId) {
                        const transitionResult = await validateAndRecordTransition(
                            supabaseAdmin,
                            tenantId,
                            currentLeadId,
                            currentStageId,
                            targetStageId,
                            "ai",
                            `IA cambió estado a ${estado_filtro}: ${resumen_conversacion.slice(0, 100)}`,
                            { estado_filtro, nombre_cliente, fecha_hora_cita }
                        );

                        if (!transitionResult.valid) {
                            console.warn(`🚫 [${t.name}] Transición bloqueada: ${transitionResult.message}`);
                            // Fallback: keep current stage, don't break the flow
                            targetStageId = currentStageId;
                            targetStageLabel = "(sin cambio - transición bloqueada)";
                        }
                    } else if (targetStageId && !currentLeadId) {
                        // New lead — record initial placement
                        // Will be recorded after insert when we have the lead ID
                    }

                    const finalChatStatus =
                        estado_filtro === "Interesado"
                            ? "Interesado activo"
                            : estado_filtro === "Calificado"
                                ? fecha_hora_cita ? "Cita agendada" : "Negociando horario"
                                : estado_filtro === "Derivado a Humano"
                                    ? "Derivado a humano"
                                    : "Descartado";

                    const leadPayload: Record<string, string> = {
                        name: nombre_cliente || "Lead WhatsApp",
                        phone: phoneClean,
                        notes: resumen_conversacion || "",
                        source: "whatsapp",
                        chat_status: finalChatStatus,
                    };
                    // stage_id is NOT NULL — only include it when we
                    // actually resolved a stage (updates keep current).
                    if (targetStageId) {
                        leadPayload.stage_id = targetStageId;
                    }

                    if (estado_filtro === "Calificado" && fecha_hora_cita) {
                        leadPayload.appointment_date = fecha_hora_cita;
                    }

                    // Id del lead resuelto (para el update best-effort de
                    // temperatura, fuera del payload crítico).
                    let scoredLeadId: string | null = null;

                    if (existingLeads && existingLeads.length > 0) {
                        scoredLeadId = existingLeads[0].id;
                        await supabaseAdmin
                            .from("leads")
                            .update(leadPayload)
                            .eq("id", existingLeads[0].id);
                        console.log(`✅ [${t.name}] Lead actualizado: ${nombre_cliente} → ${estado_filtro} [${targetStageLabel}]`);
                    } else {
                        if (!leadPayload.stage_id) {
                            const fallbackStageId = await getOrCreateFirstStage(tenantId);
                            if (fallbackStageId) leadPayload.stage_id = fallbackStageId;
                        }
                        const { data: newLeadData } = await supabaseAdmin.from("leads").upsert(
                            {
                                organization_id: tenantId,
                                ...leadPayload,
                            },
                            { onConflict: "organization_id,phone" }
                        ).select("id").single();
                        scoredLeadId = newLeadData?.id ?? null;

                        // Record initial stage placement for new leads
                        if (newLeadData?.id && targetStageId) {
                            try {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                await (supabaseAdmin as any).from("lead_stage_history").insert({
                                    lead_id: newLeadData.id,
                                    organization_id: tenantId,
                                    from_stage_id: null,
                                    to_stage_id: targetStageId,
                                    changed_by: "ai",
                                    reason: `Lead creado como ${estado_filtro}: ${resumen_conversacion.slice(0, 100)}`,
                                    metadata: { estado_filtro, nombre_cliente, fecha_hora_cita },
                                });
                            } catch (histErr) {
                                console.error("⚠️ Error guardando historial inicial:", histErr);
                            }
                        }
                        console.log(`✅ [${t.name}] Lead creado: ${nombre_cliente} → ${estado_filtro} [${targetStageLabel}]`);

                        // Auto-template: welcome new lead
                        if (newLeadData?.id) {
                            sendAutoTemplate({
                                orgId: tenantId,
                                leadId: newLeadData.id,
                                phone: phoneClean,
                                event: "welcome_new_lead",
                                parameters: [nombre_cliente || ""],
                            }).catch(err => console.error("[AutoTemplate] Welcome error:", err));
                        }
                    }

                    // 🧩 Fase 2: hechos derivados de la llamada CRM —
                    // sin costo LLM extra, la IA ya validó estos datos
                    if (leadId) {
                        saveCrmDerivedFacts({
                            orgId: tenantId,
                            leadId,
                            nombreCliente: nombre_cliente,
                            fechaHoraCita: fecha_hora_cita,
                        }).catch(() => { /* la memoria nunca bloquea */ });
                    }

                    // 🌡️ Lead Scoring: update best-effort de temperatura,
                    // FUERA del payload crítico — si la columna no existe
                    // (migración pendiente) el lead se crea igual, solo se
                    // omite el scoring. Degrada sin romper.
                    if (scoredLeadId && temperatura) {
                        void supabaseAdmin
                            .from("leads")
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            .update({ temperature: temperatura } as any)
                            .eq("id", scoredLeadId)
                            .then(({ error }) => {
                                if (error && error.code !== "42703" && error.code !== "PGRST204") {
                                    console.warn(`[LeadScore] update error (no bloqueante):`, error.message);
                                }
                            });
                    }

                    // 📈 Evento: cita confirmada vía CRM (flujo sin
                    // sistema de agenda — orgs que usan solo el pipeline)
                    if (estado_filtro === "Calificado" && fecha_hora_cita) {
                        trackEvent({
                            orgId: tenantId,
                            leadId,
                            type: "appointment_booked",
                            metadata: { source: "crm_tool", fecha: fecha_hora_cita },
                        }).catch(() => { /* no bloquear */ });
                    }

                    // ── Auto-template: stage transition ────────────────
                    {
                        const stageEventMap: Record<string, AutoTemplateEvent> = {
                            "Interesado": "stage_interested",
                            "Calificado": "stage_qualified",
                            "Derivado a Humano": "stage_handoff",
                        };
                        const autoEvent = stageEventMap[estado_filtro];
                        const effectiveLeadId = (existingLeads && existingLeads.length > 0)
                            ? existingLeads[0].id
                            : undefined;
                        if (autoEvent && effectiveLeadId) {
                            sendAutoTemplate({
                                orgId: tenantId,
                                leadId: effectiveLeadId,
                                phone: phoneClean,
                                event: autoEvent,
                                parameters: [nombre_cliente || ""],
                            }).catch(err => console.error("[AutoTemplate] Stage error:", err));
                        }
                    }

                    // ── Human handoff: notificación + pausa + alerta ──
                    if (estado_filtro === "Derivado a Humano") {
                        const { data: notifLead } = await supabaseAdmin
                            .from("leads")
                            .select("id")
                            .eq("organization_id", tenantId)
                            .eq("phone", phoneClean)
                            .limit(1)
                            .single();

                        const notifMessage =
                            nombre_cliente && nombre_cliente !== "Lead WhatsApp"
                                ? `${nombre_cliente} solicitó atención humana`
                                : `Un cliente (${phoneClean}) solicitó atención humana`;

                        await supabaseAdmin.from("notifications").insert({
                            tenant_id: tenantId,
                            lead_id: notifLead?.id || null,
                            type: "handoff",
                            message: notifMessage,
                        });
                        console.log(`🔔 [${t.name}] Notificación creada: ${notifMessage}`);

                        // Pausar el bot: el lead pidió una persona — si el
                        // bot sigue contestando contradice su propia promesa
                        // de "un asesor te contactará". El humano reactiva
                        // desde el Inbox cuando termina.
                        // 🛡️ Guardián: NO pausar — el dueño está desconectado;
                        // el bot sigue conteniendo y solo se notifica.
                        if (notifLead?.id && !guardianMode) {
                            await supabaseAdmin
                                .from("leads")
                                .update({ is_bot_paused: true })
                                .eq("id", notifLead.id);
                            console.log(`⏸️ [${t.name}] Bot pausado por handoff (lead ${notifLead.id})`);
                        } else if (notifLead?.id && guardianMode) {
                            console.log(`🛡️ [${t.name}] Handoff en Modo Guardián — bot sigue activo (lead ${notifLead.id})`);
                        }

                        // Alerta WhatsApp al dueño (fire-and-forget)
                        notifyOwnerHotLead({
                            orgId: tenantId,
                            leadName: nombre_cliente || "",
                            leadPhone: phoneClean,
                            reason: resumen_conversacion,
                        }).catch(err => console.error("[OwnerAlert] Hot lead error:", err));

                        // 📈 Evento: derivación a humano
                        trackEvent({
                            orgId: tenantId,
                            leadId: notifLead?.id || leadId,
                            type: "handoff",
                        }).catch(() => { /* no bloquear */ });

                        // 🔗 Webhook saliente por-tenant (Executive)
                        emitOutboundEvent(tenantId, "handoff", {
                            lead_id: notifLead?.id || leadId,
                            nombre: nombre_cliente || null,
                            telefono: phoneClean,
                            motivo: resumen_conversacion,
                        }).catch(() => { /* no bloquear */ });
                    }

                    // ── Optional Make/Zapier webhook ──────────────────
                    const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL;
                    if (makeWebhookUrl) {
                        try {
                            await fetch(makeWebhookUrl, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    event: "lead_updated",
                                    tenant_id: tenantId,
                                    tenant_name: t.name,
                                    lead: {
                                        nombre: nombre_cliente,
                                        telefono: phoneClean,
                                        estado: estado_filtro,
                                        fecha_cita: fecha_hora_cita || null,
                                        resumen: resumen_conversacion,
                                        timestamp: new Date().toISOString(),
                                    },
                                }),
                            });
                            console.log("🔗 Webhook enviado a Make/Zapier");
                        } catch (webhookErr) {
                            console.error("⚠️ Error enviando webhook (no bloqueante):", webhookErr);
                        }
                    }

                    // 🔗 Webhook saliente POR-TENANT (Executive, firmado)
                    emitOutboundEvent(tenantId, "lead_updated", {
                        lead_id: leadId,
                        nombre: nombre_cliente,
                        telefono: phoneClean,
                        estado: estado_filtro,
                        etapa: targetStageLabel || null,
                        fecha_cita: fecha_hora_cita || null,
                        resumen: resumen_conversacion,
                    }).catch(() => { /* no bloquear */ });

                    // Append tool response to the ephemeral turn array
                    currentTurnMessages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({
                            success: true,
                            estado: estado_filtro,
                            message: `Lead ${nombre_cliente} registrado como ${estado_filtro}`,
                        }),
                    });
                } else if (toolCall.function.name === "verificar_disponibilidad") {
                    const args = JSON.parse(toolCall.function.arguments);
                    const fecha = args.fecha;
                    const servicioNombre = args.servicio_nombre;

                    // Look up product duration if service name provided
                    let duration: number | undefined;
                    if (servicioNombre) {
                        const { data: matchProduct } = await supabaseAdmin.from("products")
                            .select("attributes")
                            .eq("organization_id", tenantId)
                            .ilike("name", `%${servicioNombre}%`)
                            .limit(1);
                        if (matchProduct?.[0]?.attributes?.duracion) {
                            duration = Number(matchProduct[0].attributes.duracion);
                        }
                    }

                    const slots = await getAvailableSlots(tenantId, fecha, duration);
                    const dayNames = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
                    const d = new Date(`${fecha}T12:00:00`);

                    currentTurnMessages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({
                            disponible: slots.length > 0,
                            fecha,
                            dia_semana: dayNames[d.getDay()],
                            horarios_disponibles: slots.map(s => s.start.slice(11,16)),
                            total_slots: slots.length,
                            duracion_slot_minutos: duration || appointmentConfig.slot_duration_minutes,
                        }),
                    });
                } else if (toolCall.function.name === "agendar_cita") {
                    const args = JSON.parse(toolCall.function.arguments);

                    // Look up product
                    let productId: string | undefined;
                    let duration = appointmentConfig.slot_duration_minutes;
                    if (args.servicio_nombre) {
                        const { data: matchProduct } = await supabaseAdmin.from("products")
                            .select("id, attributes")
                            .eq("organization_id", tenantId)
                            .ilike("name", `%${args.servicio_nombre}%`)
                            .limit(1);
                        if (matchProduct?.[0]) {
                            productId = matchProduct[0].id;
                            if (matchProduct[0].attributes?.duracion) {
                                duration = Number(matchProduct[0].attributes.duracion);
                            }
                        }
                    }

                    const startTime = args.fecha_hora;
                    const endDate = new Date(new Date(startTime).getTime() + duration * 60000);
                    const endTime = endDate.toISOString();

                    const result = await bookAppointment({
                        orgId: tenantId,
                        leadId: leadId!,
                        productId,
                        startTime,
                        endTime,
                        notes: args.notas || `Cita para ${args.servicio_nombre}. Cliente: ${args.nombre_cliente}`,
                    });

                    if (result.success) {
                        // 📈 Evento: cita creada por el sistema de agenda
                        trackEvent({
                            orgId: tenantId,
                            leadId,
                            type: "appointment_booked",
                            metadata: { source: "scheduler", appointment_id: result.appointment.id },
                        }).catch(() => { /* no bloquear */ });

                        // 🔗 Webhook saliente por-tenant (Executive)
                        emitOutboundEvent(tenantId, "appointment_booked", {
                            lead_id: leadId,
                            appointment_id: result.appointment.id,
                            cliente: args.nombre_cliente || null,
                            telefono: phoneClean,
                            servicio: args.servicio_nombre || null,
                            fecha_hora: startTime,
                        }).catch(() => { /* no bloquear */ });

                        // Update lead name if still generic
                        const { data: currentLead } = await supabaseAdmin
                            .from("leads")
                            .select("name")
                            .eq("id", leadId!)
                            .single();
                        if (currentLead?.name === "Lead WhatsApp" || currentLead?.name?.startsWith("Lead")) {
                            await supabaseAdmin.from("leads").update({ name: args.nombre_cliente }).eq("id", leadId!);
                        }

                        // Send confirmation — try template first, fallback to text
                        const confirmFallback = `✅ *Cita confirmada*\nServicio: ${args.servicio_nombre}\nFecha: ${formatChileDate(startTime)}\n\n¡Te esperamos!\n\nPara cancelar o cambiar tu cita, escribe "cancelar cita" o "cambiar cita".`;
                        sendAutoTemplate({
                            orgId: tenantId,
                            leadId: leadId!,
                            phone: phoneClean,
                            event: "appointment_confirmed",
                            parameters: [args.nombre_cliente || "", args.servicio_nombre || "", formatChileDate(startTime)],
                            fallbackText: confirmFallback,
                        }).catch(err => console.error("[AutoTemplate] Confirm error:", err));

                        currentTurnMessages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({
                                exito: true,
                                mensaje: `Cita agendada exitosamente para ${formatChileDate(startTime)}.`,
                                appointment_id: result.appointment.id,
                            }),
                        });
                    } else {
                        currentTurnMessages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({
                                exito: false,
                                error: result.error,
                                mensaje: "No se pudo agendar. Sugiere otro horario.",
                            }),
                        });
                    }
                } else if (toolCall.function.name === "gestionar_cita_existente") {
                    const args = JSON.parse(toolCall.function.arguments);

                    // Find lead's most recent confirmed appointment
                    const { data: appts } = await supabaseAdmin
                        .from("appointments")
                        .select("id, start_time, end_time, product_id, products(name)")
                        .eq("lead_id", leadId!)
                        .eq("organization_id", tenantId)
                        .eq("status", "confirmed")
                        .order("start_time", { ascending: false })
                        .limit(1);

                    let toolResultContent: string;

                    if (!appts || appts.length === 0) {
                        toolResultContent = JSON.stringify({
                            exito: false,
                            error: "El cliente no tiene citas activas.",
                        });
                    } else {
                        const appt = appts[0];

                        if (args.accion === "cancelar") {
                            if (!appointmentConfig.allow_client_cancel) {
                                toolResultContent = JSON.stringify({
                                    exito: false,
                                    error: "La cancelación por WhatsApp no está habilitada. Deriva al cliente a un humano.",
                                });
                            } else {
                                await cancelAppointment(appt.id, tenantId, args.motivo || "Cancelada por el cliente via WhatsApp");
                                const cancelFallback = `❌ Tu cita del ${formatChileDate(appt.start_time)} ha sido cancelada.\n\nSi deseas agendar una nueva cita, ¡estoy aquí para ayudarte!`;
                                sendAutoTemplate({
                                    orgId: tenantId,
                                    leadId: leadId!,
                                    phone: phoneClean,
                                    event: "appointment_cancelled",
                                    parameters: [formatChileDate(appt.start_time)],
                                    fallbackText: cancelFallback,
                                }).catch(err => console.error("[AutoTemplate] Cancel error:", err));
                                toolResultContent = JSON.stringify({
                                    exito: true,
                                    mensaje: "Cita cancelada exitosamente.",
                                });
                            }
                        } else if (args.accion === "reprogramar") {
                            if (!appointmentConfig.allow_client_reschedule || appointmentConfig.reschedule_policy === "escalate_to_human") {
                                toolResultContent = JSON.stringify({
                                    exito: false,
                                    error: "La reprogramación requiere hablar con un asesor humano. Deriva al cliente.",
                                    derivar_a_humano: true,
                                });
                            } else if (!args.nueva_fecha_hora) {
                                toolResultContent = JSON.stringify({
                                    exito: false,
                                    error: "Se necesita la nueva fecha y hora para reprogramar. Primero verifica disponibilidad.",
                                });
                            } else {
                                const apptDuration = (new Date(appt.end_time).getTime() - new Date(appt.start_time).getTime()) / 60000;
                                const newEnd = new Date(new Date(args.nueva_fecha_hora).getTime() + apptDuration * 60000).toISOString();

                                const result = await rescheduleAppointment({
                                    appointmentId: appt.id,
                                    orgId: tenantId,
                                    leadId: leadId!,
                                    productId: appt.product_id || undefined,
                                    newStartTime: args.nueva_fecha_hora,
                                    newEndTime: newEnd,
                                });

                                if (result.success) {
                                    const rescheduleFallback = `🔄 *Cita reprogramada*\nNueva fecha: ${formatChileDate(args.nueva_fecha_hora)}\n\n¡Te esperamos!`;
                                    sendAutoTemplate({
                                        orgId: tenantId,
                                        leadId: leadId!,
                                        phone: phoneClean,
                                        event: "appointment_rescheduled",
                                        parameters: [formatChileDate(args.nueva_fecha_hora)],
                                        fallbackText: rescheduleFallback,
                                    }).catch(err => console.error("[AutoTemplate] Reschedule error:", err));
                                    toolResultContent = JSON.stringify({
                                        exito: true,
                                        mensaje: `Cita reprogramada para ${formatChileDate(args.nueva_fecha_hora)}.`,
                                    });
                                } else {
                                    toolResultContent = JSON.stringify({
                                        exito: false,
                                        error: result.error,
                                    });
                                }
                            }
                        } else {
                            toolResultContent = JSON.stringify({
                                exito: false,
                                error: "Acción no reconocida. Usa 'cancelar' o 'reprogramar'.",
                            });
                        }
                    }

                    currentTurnMessages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: toolResultContent,
                    });
                }
            }

            // Follow-up call — get the final conversational text after tool use
            const followUp = await tenantOpenai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...sanitizeMessageHistory(currentTurnMessages),
                ],
            });

            // 📊 Telemetría de costos por tenant
            logOpenAiCompletionUsage(tenantId, leadId, "gpt-4o-mini", "chat_followup", followUp.usage);

            botResponse = followUp.choices[0].message.content || "¡Gracias por tu interés!";
        }

        // Sanitize before sending and saving
        botResponse = sanitizeBotResponse(botResponse);

        // ── 8. Persist bot response to Supabase ───────────────
        // lead_messages is the single source of truth for history.
        // No in-memory state to maintain or truncate.
        let botMessageRowId: string | null = null;
        if (leadId && botResponse) {
            const { data: insertedMsg } = await supabaseAdmin
                .from("lead_messages")
                .insert({
                    lead_id: leadId,
                    role: "assistant",
                    content: botResponse,
                })
                .select("id")
                .single();
            botMessageRowId = insertedMsg?.id ?? null;
        }

        // 📈 Evento: respuesta del bot con latencia percibida
        // (desde el último mensaje del cliente, debounce incluido)
        if (botResponse) {
            const latencyMs = params.lastUserMessageAt
                ? Math.max(0, Date.now() - new Date(params.lastUserMessageAt).getTime())
                : undefined;
            trackEvent({
                orgId: tenantId,
                leadId,
                type: "bot_replied",
                latencyMs,
                metadata: { batch_size: params.batchMessageCount ?? 1 },
            }).catch(() => { /* analytics nunca bloquea */ });
        }

        // ── 8b. Fase 2: mantenimiento de memoria (fire-and-forget)
        // Resumen progresivo cada ~10 msgs + extracción de hechos
        // cada ~6 msgs del cliente. Nunca bloquean la respuesta.
        if (leadId) {
            maybeUpdateRollingSummary({
                orgId: tenantId,
                leadId,
                openaiApiKey: t.openai_api_key,
            }).catch(() => { /* no bloquear */ });
            maybeExtractMemories({
                orgId: tenantId,
                leadId,
                openaiApiKey: t.openai_api_key,
            }).catch(() => { /* no bloquear */ });
        }

        // ── 9. Send reply (flujo asíncrono/cola) ─────────────
        if (sendReply && botResponse) {
            const sendResult = await sendWhatsAppMessage(tenantId, phoneClean, botResponse);
            if (!sendResult.success) {
                captureError(
                    new Error(sendResult.error || "send_failed"),
                    "processor:send",
                    { orgId: tenantId, phone: phoneClean }
                );
                // ⚠ inmediato en el inbox: el envío mismo falló
                if (botMessageRowId) {
                    markOutboundFailed(botMessageRowId, sendResult.error || "send_failed")
                        .catch(() => { /* no bloquear */ });
                }
            } else if (botMessageRowId && sendResult.providerMessageId) {
                // ✓ vincula el wamid → los statuses de Meta actualizarán
                // esta fila (delivered/read) vía webhook + Realtime
                linkOutboundMessage(botMessageRowId, sendResult.providerMessageId)
                    .catch(() => { /* no bloquear */ });
            }
        }

        return { botResponse };
    } catch (error) {
        captureError(error, "processor:turn", { orgId: tenantId, phone: phoneClean });
        return { botResponse: null };
    }
}
