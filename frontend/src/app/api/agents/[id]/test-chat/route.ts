import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, serverError } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateEmbedding, generateAgentResponse } from "@/lib/openai";
import type { SearchResult } from "@/lib/types";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: agentId } = await params;

    // Authenticate
    const authResult = await authenticateRequest("test-chat");
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    try {
        const { message, history = [] } = await req.json();

        if (!message || typeof message !== "string") {
            return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 });
        }

        const db = getSupabaseAdmin();

        // Fetch agent and verify it belongs to the user's org
        const { data: agent, error: agentError } = await db
            .from("agents")
            .select("id, organization_id, system_prompt, scraped_context, temperature, welcome_message")
            .eq("id", agentId)
            .single();

        if (agentError || !agent) {
            return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });
        }

        if (agent.organization_id !== auth.orgId) {
            return NextResponse.json({ error: "Sin acceso a este agente" }, { status: 403 });
        }

        // Build system prompt with scraped context
        let fullPrompt = agent.system_prompt || "Eres un asistente virtual amable y profesional.";
        if (agent.scraped_context) {
            fullPrompt += "\n\n---\nCONTEXTO ADICIONAL:\n" + agent.scraped_context;
        }

        // RAG: search relevant products
        let searchResults: SearchResult[] = [];
        try {
            const embedding = await generateEmbedding(message);
            const { data: matches } = await db.rpc("match_products", {
                query_embedding: embedding,
                match_org_id: auth.orgId,
                threshold: 0.3,
                match_count: 3,
            });
            if (matches) {
                searchResults = matches.map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    description: m.description || "",
                    attributes: m.attributes || {},
                    similarity: m.similarity,
                }));
            }
        } catch {
            // RAG is best-effort — continue without results
        }

        // Generate response
        const response = await generateAgentResponse({
            systemPrompt: fullPrompt,
            context: searchResults,
            history: history.slice(-10),
            userMessage: message,
            temperature: agent.temperature ?? 0.7,
        });

        return NextResponse.json({ response });
    } catch (err) {
        return serverError(err, "test-chat");
    }
}
