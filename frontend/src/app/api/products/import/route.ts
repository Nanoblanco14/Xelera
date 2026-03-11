import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyOrgAccess, apiError, serverError } from "@/lib/api-auth";
import Papa from "papaparse";
import * as XLSX from "xlsx";

// ═══════════════════════════════════════════════════════════════
//  POST /api/products/import — Parse CSV/Excel and return preview
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
    try {
        const result = await authenticateRequest("products-import:POST");
        if ("error" in result) return result.error;
        const { auth } = result;

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const orgId = formData.get("organization_id") as string | null;

        if (!file) return apiError("Archivo requerido", 400);
        if (!orgId) return apiError("organization_id requerido", 400);

        const orgCheck = verifyOrgAccess(auth, orgId);
        if (orgCheck) return orgCheck;

        const fileName = file.name.toLowerCase();
        let headers: string[] = [];
        let rows: Record<string, string>[] = [];

        // ── CSV parsing ──
        if (fileName.endsWith(".csv")) {
            const text = await file.text();
            const parsed = Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (h: string) => h.trim(),
            });

            if (parsed.errors.length > 0 && parsed.data.length === 0) {
                return apiError(
                    `Error parseando CSV: ${parsed.errors[0]?.message || "formato inválido"}`,
                    400
                );
            }

            headers = parsed.meta.fields || [];
            rows = parsed.data as Record<string, string>[];
        }
        // ── Excel parsing ──
        else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array" });

            // Use first sheet
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) return apiError("El archivo Excel está vacío", 400);

            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
                defval: "",
                raw: false,
            });

            if (jsonData.length === 0) {
                return apiError("No se encontraron datos en el archivo", 400);
            }

            headers = Object.keys(jsonData[0] || {});
            rows = jsonData;
        } else {
            return apiError(
                "Formato no soportado. Usa archivos .csv, .xlsx o .xls",
                400
            );
        }

        // Clean empty headers
        headers = headers.filter(h => h.trim().length > 0);

        // Limit preview to 100 rows max (for performance)
        const preview = rows.slice(0, 100).map(row => {
            const clean: Record<string, string> = {};
            for (const h of headers) {
                clean[h] = String(row[h] ?? "").trim();
            }
            return clean;
        });

        return NextResponse.json({
            headers,
            preview,
            total: rows.length,
            allData: rows, // Full dataset for import confirmation
        });
    } catch (err) {
        return serverError(err, "products-import:POST");
    }
}
