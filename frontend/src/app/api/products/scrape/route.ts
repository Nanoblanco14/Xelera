import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyOrgAccess, apiError, serverError } from "@/lib/api-auth";
import * as cheerio from "cheerio";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ═══════════════════════════════════════════════════════════════
//  POST /api/products/scrape — Scrape website + AI extraction
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("products-scrape:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const body = await req.json();
        const { url, organization_id } = body;

        if (!url) return apiError("URL requerida", 400);
        if (!organization_id) return apiError("organization_id requerido", 400);

        const orgCheck = verifyOrgAccess(auth, organization_id);
        if (orgCheck) return orgCheck;

        // Validate URL
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
            if (!["http:", "https:"].includes(parsedUrl.protocol)) {
                return apiError("URL debe empezar con http:// o https://", 400);
            }
        } catch {
            return apiError("URL inválida", 400);
        }

        // ── Fetch page HTML ──
        let html: string;
        try {
            const res = await fetch(parsedUrl.toString(), {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    Accept: "text/html,application/xhtml+xml",
                    "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
                },
                signal: AbortSignal.timeout(15000), // 15s timeout
            });

            if (!res.ok) {
                return apiError(
                    `No se pudo acceder a la página (status ${res.status})`,
                    400
                );
            }

            html = await res.text();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "error desconocido";
            return apiError(`Error accediendo a la URL: ${msg}`, 400);
        }

        // ── Extract text with Cheerio ──
        const $ = cheerio.load(html);

        // Remove non-content elements
        $("script, style, noscript, svg, iframe, nav, footer, header").remove();

        // Get page title
        const pageTitle = $("title").text().trim();

        // Extract meaningful text from the page
        const textBlocks: string[] = [];

        // Get meta description
        const metaDesc =
            $('meta[name="description"]').attr("content") ||
            $('meta[property="og:description"]').attr("content") ||
            "";
        if (metaDesc) textBlocks.push(`Descripción del sitio: ${metaDesc}`);

        // Get all text content from main content areas
        const contentSelectors = [
            "main",
            "article",
            '[role="main"]',
            ".content",
            ".products",
            ".listings",
            ".properties",
            ".items",
            ".catalog",
            "#content",
            "#main",
        ];

        let mainContent = "";
        for (const sel of contentSelectors) {
            const text = $(sel).text().trim();
            if (text.length > 100) {
                mainContent = text;
                break;
            }
        }

        // Fallback: get body text
        if (!mainContent) {
            mainContent = $("body").text().trim();
        }

        // Clean up text (collapse empty lines, then collapse remaining whitespace)
        mainContent = mainContent
            .replace(/\n\s*\n/g, "\n")
            .replace(/[^\S\n]+/g, " ")
            .trim();

        // Limit to ~6000 chars for GPT context
        const truncatedText = mainContent.slice(0, 6000);
        textBlocks.push(truncatedText);

        const pageText = textBlocks.join("\n\n");

        if (pageText.length < 50) {
            return apiError(
                "No se pudo extraer contenido suficiente de la página. Verifica que la URL sea correcta.",
                400
            );
        }

        // ── AI Extraction ──
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.1,
            max_tokens: 4000,
            messages: [
                {
                    role: "system",
                    content: `Eres un experto en extracción de datos de páginas web. Tu tarea es analizar el contenido de una página web y extraer TODOS los productos, propiedades, servicios o ítems que encuentres.

REGLAS:
- Extrae CADA producto/ítem individual que encuentres en el texto
- Para cada uno, identifica: nombre, descripción, precio (si hay), y cualquier atributo relevante
- Los atributos pueden ser: ubicación, habitaciones, baños, metros cuadrados, stock, tallas, colores, categoría, etc.
- Si encuentras precios, normalizalos como número (sin símbolos de moneda en el valor)
- Si no encuentras productos claros, retorna un array vacío
- SIEMPRE retorna JSON válido

FORMATO DE RESPUESTA (JSON array):
[
  {
    "name": "Nombre del producto",
    "description": "Descripción breve",
    "attributes": {
      "precio": "150000",
      "ubicacion": "Santiago Centro",
      "habitaciones": "3"
    }
  }
]

Retorna SOLO el JSON array, sin texto adicional, sin markdown, sin backticks.`,
                },
                {
                    role: "user",
                    content: `Página: ${pageTitle}\nURL: ${url}\n\nContenido:\n${pageText}`,
                },
            ],
        });

        const aiText = aiResponse.choices[0]?.message?.content?.trim() || "[]";

        // Parse AI response
        let extractedProducts: {
            name: string;
            description?: string;
            attributes?: Record<string, string>;
        }[] = [];

        try {
            // Try to extract JSON from the response (handle markdown code blocks)
            let jsonStr = aiText;
            const jsonMatch = aiText.match(/\[[\s\S]*\]/);
            if (jsonMatch) jsonStr = jsonMatch[0];

            extractedProducts = JSON.parse(jsonStr);

            if (!Array.isArray(extractedProducts)) {
                extractedProducts = [];
            }

            // Clean up and validate
            extractedProducts = extractedProducts
                .filter(p => p && typeof p.name === "string" && p.name.trim().length > 0)
                .map(p => ({
                    name: p.name.trim(),
                    description: (p.description || "").trim(),
                    attributes: p.attributes || {},
                }));
        } catch {
            console.error("[scrape] Failed to parse AI response:", aiText.slice(0, 200));
            return apiError(
                "La IA no pudo extraer productos de esta página. Intenta con otra URL o usa importación CSV.",
                400
            );
        }

        return NextResponse.json({
            success: true,
            source_url: url,
            page_title: pageTitle,
            products: extractedProducts,
            total: extractedProducts.length,
        });
    } catch (err) {
        return serverError(err, "products-scrape:POST");
    }
}
