import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { authenticateRequest, serverError } from "@/lib/api-auth";

// ── POST /api/pipeline/stage-rules/generate ─────────────────
// Auto-generate default transition rules based on current stages
export async function POST(req: NextRequest) {
    void req; // consumed by authenticateRequest
    try {
        const result = await authenticateRequest("stage-rules-generate:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const db = getSupabaseAdmin();

        // Get all stages for this org ordered by position
        const { data: stages, error: stagesErr } = await db
            .from("pipeline_stages")
            .select("id, name, position")
            .eq("organization_id", auth.orgId)
            .order("position", { ascending: true });

        if (stagesErr) throw stagesErr;
        if (!stages || stages.length < 2) {
            return NextResponse.json({
                data: [],
                message: "Se necesitan al menos 2 etapas para generar reglas"
            });
        }

        // Find "Descartado" / "Perdido" / "Cancelado" stage
        const descartadoStage = stages.find(s =>
            /descart|perdid|cancel/i.test(s.name)
        );

        const rules: Array<{
            organization_id: string;
            from_stage_id: string;
            to_stage_id: string;
            is_ai_allowed: boolean;
        }> = [];

        // 1. Linear forward transitions (stage N → stage N+1) — AI allowed
        for (let i = 0; i < stages.length - 1; i++) {
            rules.push({
                organization_id: auth.orgId,
                from_stage_id: stages[i].id,
                to_stage_id: stages[i + 1].id,
                is_ai_allowed: true,
            });
        }

        // 2. Any stage → Descartado — AI allowed
        if (descartadoStage) {
            for (const stage of stages) {
                if (stage.id !== descartadoStage.id) {
                    rules.push({
                        organization_id: auth.orgId,
                        from_stage_id: stage.id,
                        to_stage_id: descartadoStage.id,
                        is_ai_allowed: true,
                    });
                }
            }
        }

        // 3. Backward transitions (N → N-1) — humans only
        for (let i = 1; i < stages.length; i++) {
            if (descartadoStage && stages[i].id === descartadoStage.id) continue;
            rules.push({
                organization_id: auth.orgId,
                from_stage_id: stages[i].id,
                to_stage_id: stages[i - 1].id,
                is_ai_allowed: false,
            });
        }

        // Upsert all rules (ignore duplicates)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dbAny = db as any;
        const { data: inserted, error: insertErr } = await dbAny
            .from("pipeline_stage_rules")
            .upsert(rules, {
                onConflict: "organization_id,from_stage_id,to_stage_id",
            })
            .select();

        if (insertErr) throw insertErr;

        return NextResponse.json({
            data: inserted,
            message: `${inserted?.length || 0} reglas generadas exitosamente`
        });
    } catch (err) {
        return serverError(err, "stage-rules-generate:POST");
    }
}
