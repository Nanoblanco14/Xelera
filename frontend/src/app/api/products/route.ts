import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateEmbedding, buildProductText } from "@/lib/openai";
import { authenticateRequest, verifyOrgAccess, apiError, serverError } from "@/lib/api-auth";
import { checkResourceLimit } from "@/lib/plan-limits";
import type { ProductCreate } from "@/lib/types";

// ── GET /api/products?org_id=xxx ───────────────────────────
export async function GET(req: NextRequest) {
    try {
        const result = await authenticateRequest("products:GET");
        if ("error" in result) return result.error;
        const { auth } = result;

        const orgId = req.nextUrl.searchParams.get("org_id");
        if (!orgId) return apiError("org_id required", 400, "MISSING_PARAM");

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const db = getSupabaseAdmin();
        const { data, error } = await db
            .from("products")
            .select("*, product_files(*)")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        return serverError(err, "products:GET");
    }
}

// ── POST /api/products ─────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("products:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const body: ProductCreate = await req.json();
        const { organization_id, name, description, attributes } = body;

        if (!organization_id || !name) {
            return apiError("organization_id and name required", 400, "MISSING_FIELDS");
        }

        const orgCheck = verifyOrgAccess(auth, organization_id);
        if (orgCheck) return orgCheck;

        // ── Plan limit check ──
        const limit = await checkResourceLimit(organization_id, "products");
        if (!limit.allowed) {
            return apiError(limit.message!, 403, "PLAN_LIMIT");
        }

        const productText = buildProductText({ name, description: description || "", attributes: attributes || {} });
        let embedding: number[] | null = null;
        try {
            embedding = await generateEmbedding(productText);
        } catch (e) {
            console.error("[API:products:POST] Embedding generation failed:", e);
        }

        const db = getSupabaseAdmin();
        const insertData: Record<string, unknown> = {
            organization_id,
            name,
            description: description || "",
            attributes: attributes || {},
            status: "active",
        };
        if (embedding) {
            insertData.embedding = JSON.stringify(embedding);
        }

        const { data, error } = await db
            .from("products")
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data }, { status: 201 });
    } catch (err) {
        return serverError(err, "products:POST");
    }
}
