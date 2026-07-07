// ═══════════════════════════════════════════════════════════════
//  🎭 DEMO CHAT — endpoint PÚBLICO del demo de la landing
//
//  Aislamiento total: OPENAI_API_KEY de plataforma (nunca keys de
//  tenants), CERO escrituras a DB, historial stateless en el
//  request. Superficie de abuso controlada:
//    - Rate limit en memoria por IP (20 req / 10 min)
//    - Máx. 10 turnos por sesión, 500 chars por mensaje
//  Nota prod: para rate limit multi-instancia usar Upstash.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
    buildDemoSystemPrompt,
    DEMO_MAX_TURNS,
    DEMO_MAX_MSG_CHARS,
    sanitizeDemoHistory,
} from "@/lib/demo-agent";
import { captureError } from "@/lib/monitoring";

// ── Rate limit en memoria por IP ─────────────────────────────
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 20;
const ipHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const hits = (ipHits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
    if (hits.length >= RATE_MAX_REQUESTS) {
        ipHits.set(ip, hits);
        return true;
    }
    hits.push(now);
    ipHits.set(ip, hits);
    // Poda ocasional del mapa (evita crecer sin límite)
    if (ipHits.size > 5000) {
        for (const [k, v] of ipHits) {
            if (v.every((t) => now - t >= RATE_WINDOW_MS)) ipHits.delete(k);
        }
    }
    return false;
}

export async function POST(req: NextRequest) {
    try {
        const ip =
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            req.headers.get("x-real-ip") ||
            "unknown";

        if (isRateLimited(ip)) {
            return NextResponse.json(
                { error: "Demasiadas consultas — intenta en unos minutos, o crea tu propio agente gratis 😉" },
                { status: 429 }
            );
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "Demo no disponible temporalmente" },
                { status: 503 }
            );
        }

        const body = await req.json().catch(() => null);
        const message: string = (body?.message || "").toString().trim();
        const history = sanitizeDemoHistory(body?.history ?? []);

        if (!message || message.length > DEMO_MAX_MSG_CHARS || history === null) {
            return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });
        }

        const userTurns = history.filter((m) => m.role === "user").length;
        if (userTurns >= DEMO_MAX_TURNS) {
            return NextResponse.json({
                data: {
                    reply:
                        "¡Este demo llegó a su límite! 🎉 Pero tu agente real conversa sin límites: " +
                        "créalo gratis en minutos con el botón \"Empezar gratis\".",
                    ended: true,
                },
            });
        }

        const openai = new OpenAI({ apiKey, timeout: 25_000 });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 300,
            messages: [
                // industry inválida → cae a real_estate (getDemoProfile)
                { role: "system", content: buildDemoSystemPrompt(body?.industry) },
                ...history,
                { role: "user", content: message },
            ],
        });

        const reply =
            completion.choices[0]?.message?.content?.trim() ||
            "¡Hola! ¿Buscas comprar o arrendar? 🏠";

        // 📊 Telemetría del demo: SOLO consola (ai_usage_log exige una
        // org real — el demo no toca DB por diseño)
        console.log(
            `🎭 [Demo] IP ${ip} turno ${userTurns + 1}/${DEMO_MAX_TURNS} — ${completion.usage?.total_tokens ?? "?"} tokens`
        );

        return NextResponse.json({
            data: { reply, ended: userTurns + 1 >= DEMO_MAX_TURNS },
        });
    } catch (err) {
        captureError(err, "demo-chat");
        return NextResponse.json(
            { error: "El demo tuvo un problema — intenta de nuevo" },
            { status: 500 }
        );
    }
}
