import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateEmbedding, buildProductText } from "@/lib/openai";
import { authenticateRequest, verifyOrgAccess, apiError, serverError } from "@/lib/api-auth";

// ═══════════════════════════════════════════════════════════════
//  POST /api/products/import/confirm — Batch import products
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("products-import-confirm:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const body = await req.json();
        const { organization_id, products } = body as {
            organization_id: string;
            products: {
                name: string;
                description?: string;
                attributes?: Record<string, string | number | boolean>;
            }[];
        };

        if (!organization_id) return apiError("organization_id requerido", 400);
        if (!products || !Array.isArray(products) || products.length === 0) {
            return apiError("No hay productos para importar", 400);
        }
        if (products.length > 500) {
            return apiError("Máximo 500 productos por importación. Divide tu archivo en lotes más pequeños.", 400);
        }

        const orgCheck = verifyOrgAccess(auth, organization_id);
        if (orgCheck) return orgCheck;

        const db = getSupabaseAdmin();
        let imported = 0;
        let failed = 0;
        const errors: string[] = [];

        // Process products in batches of 5 to avoid rate limits
        const BATCH_SIZE = 5;
        for (let i = 0; i < products.length; i += BATCH_SIZE) {
            const batch = products.slice(i, i + BATCH_SIZE);

            const promises = batch.map(async (product, batchIdx) => {
                const idx = i + batchIdx;
                const name = (product.name || "").trim();

                if (!name) {
                    failed++;
                    errors.push(`Fila ${idx + 1}: nombre vacío, omitido`);
                    return;
                }

                try {
                    const description = (product.description || "").trim();
                    const attributes = product.attributes || {};

                    // Generate embedding
                    const productText = buildProductText({ name, description, attributes });
                    let embedding: number[] | null = null;
                    try {
                        embedding = await generateEmbedding(productText);
                    } catch (e) {
                        console.error(`[import] Embedding failed for "${name}":`, e);
                    }

                    const insertData: Record<string, unknown> = {
                        organization_id,
                        name,
                        description,
                        attributes,
                        status: "active",
                    };

                    if (embedding) {
                        insertData.embedding = JSON.stringify(embedding);
                    }

                    const { error: insertError } = await db
                        .from("products")
                        .insert(insertData);

                    if (insertError) {
                        failed++;
                        errors.push(`Fila ${idx + 1} ("${name}"): ${insertError.message}`);
                    } else {
                        imported++;
                    }
                } catch (err: unknown) {
                    failed++;
                    const msg = err instanceof Error ? err.message : "error desconocido";
                    errors.push(`Fila ${idx + 1} ("${name}"): ${msg}`);
                }
            });

            await Promise.all(promises);

            // Small delay between batches to respect OpenAI rate limits
            if (i + BATCH_SIZE < products.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return NextResponse.json({
            success: true,
            total: products.length,
            imported,
            failed,
            errors: errors.slice(0, 20), // Limit error messages
        });
    } catch (err) {
        return serverError(err, "products-import-confirm:POST");
    }
}
