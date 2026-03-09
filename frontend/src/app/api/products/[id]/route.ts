import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateEmbedding, buildProductText } from "@/lib/openai";
import { authenticateRequest, apiError, serverError } from "@/lib/api-auth";
import type { ProductUpdate } from "@/lib/types";

// ── PUT /api/products/[id] ─────────────────────────────────
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const result = await authenticateRequest("products:PUT");
        if ("error" in result) return result.error;
        const { auth } = result;

        const { id } = await params;
        const body: ProductUpdate = await req.json();
        const db = getSupabaseAdmin();

        // Verify the product belongs to the user's org
        const { data: current } = await db
            .from("products")
            .select("organization_id, name, description, attributes")
            .eq("id", id)
            .single();

        if (!current || current.organization_id !== auth.orgId) {
            return apiError("Producto no encontrado", 404, "NOT_FOUND");
        }

        // Build update payload
        const updateData: Record<string, unknown> = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.attributes !== undefined) updateData.attributes = body.attributes;
        if (body.status !== undefined) updateData.status = body.status;

        // Regenerate embedding if content changed
        if (body.name !== undefined || body.description !== undefined || body.attributes !== undefined) {
            const merged = {
                name: body.name ?? current.name,
                description: body.description ?? current.description,
                attributes: body.attributes ?? current.attributes,
            };
            const productText = buildProductText(merged);
            try {
                const embedding = await generateEmbedding(productText);
                updateData.embedding = JSON.stringify(embedding);
            } catch (e) {
                console.error("[API:products:PUT] Embedding regeneration failed:", e);
            }
        }

        const { data, error } = await db
            .from("products")
            .update(updateData)
            .eq("id", id)
            .select("*, product_files(*)")
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        return serverError(err, "products:PUT");
    }
}

// ── DELETE /api/products/[id] ──────────────────────────────
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const result = await authenticateRequest("products:DELETE");
        if ("error" in result) return result.error;
        const { auth } = result;

        const { id } = await params;
        const db = getSupabaseAdmin();

        // Verify the product belongs to the user's org
        const { data: existing } = await db
            .from("products")
            .select("organization_id")
            .eq("id", id)
            .single();

        if (!existing || existing.organization_id !== auth.orgId) {
            return apiError("Producto no encontrado", 404, "NOT_FOUND");
        }

        const { error } = await db.from("products").delete().eq("id", id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        return serverError(err, "products:DELETE");
    }
}
