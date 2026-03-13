"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useOrg } from "@/lib/org-context";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";
import type { IndustryField } from "@/lib/industry-templates";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, Package, Search, X, Trash2, Upload, FileText,
    Image as ImageIcon, Loader2, GripVertical, LayoutGrid,
    List, ArrowUpDown, CheckSquare, Square, Download,
    Eye, EyeOff, Archive, Filter, Edit3,
    Globe, AlertCircle, CheckCircle, ArrowRight, ArrowLeft,
    Sparkles, Table2,
} from "lucide-react";

/* ── Types ────────────────────────────────────────── */
interface CatalogItem {
    id: string;
    name: string;
    description: string;
    attributes: Record<string, string>;
    status: string;
    embedding: number[] | null;
    created_at: string;
    product_files?: PFile[];
}
interface PFile {
    id: string;
    file_url: string;
    file_name: string;
    file_type: string;
    file_size: number;
}
interface AttrRow { key: string; value: string }

/* ── Helpers ──────────────────────────────────────── */
const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
const fmtSize = (b: number) =>
    b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(1) + " MB";

const fmtPrice = (price: string | number, currency?: string) => {
    const num = Number(price);
    if (isNaN(num) || !price) return String(price);
    if (currency === "UF") {
        return `UF ${num.toLocaleString("es-CL", { minimumFractionDigits: num % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}`;
    }
    return `$${num.toLocaleString("es-CL")}`;
};

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string; glow?: string }> = {
    active: { label: "Activo", color: "#22c55e", bg: "rgba(34,197,94,0.1)", dot: "#22c55e", glow: "0 0 6px rgba(34,197,94,0.4)" },
    inactive: { label: "Inactivo", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", dot: "#f59e0b" },
    archived: { label: "Archivado", color: "#52525b", bg: "rgba(82,82,91,0.15)", dot: "#52525b" },
};

/* ── Page Component ───────────────────────────────── */
export default function CatalogPage() {
    const { organization } = useOrg();
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    /* View & Filter state */
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "archived">("all");
    const [sortBy, setSortBy] = useState<"date" | "name" | "price" | "status">("date");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkMode, setBulkMode] = useState(false);

    /* Detect industry from org settings */
    const industryId = (organization as any)?.settings?.industry_template ?? "real_estate";
    const template = INDUSTRY_TEMPLATES.find(t => t.id === industryId) ?? INDUSTRY_TEMPLATES[1];
    const itemLabel = template.catalogLabel;
    const itemGender = template.catalogGender ?? "m";
    const itemNew = itemGender === "f" ? `Nueva ${itemLabel}` : `Nuevo ${itemLabel}`;
    const itemFirst = itemGender === "f" ? `Primera ${itemLabel}` : `Primer ${itemLabel}`;
    const industryFields: IndustryField[] = template.industryFields;

    /* Modal state */
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState<CatalogItem | null>(null);
    const [viewItem, setViewItem] = useState<CatalogItem | null>(null);

    /* Form state */
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
    const [quickFields, setQuickFields] = useState<Record<string, string>>({});
    const [attrs, setAttrs] = useState<AttrRow[]>([]);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [existingFiles, setExistingFiles] = useState<PFile[]>([]);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    /* ── Import modal state ──────────────────────── */
    const [showImport, setShowImport] = useState(false);
    const [importTab, setImportTab] = useState<"csv" | "scrape">("csv");

    // CSV state
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
    const [csvAllData, setCsvAllData] = useState<Record<string, string>[]>([]);
    const [csvTotal, setCsvTotal] = useState(0);
    const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
    const [csvStep, setCsvStep] = useState(1); // 1=upload, 2=map, 3=confirm
    const [csvParsing, setCsvParsing] = useState(false);
    const [csvImporting, setCsvImporting] = useState(false);
    const [csvResult, setCsvResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);

    // Scrape state
    const [scrapeUrl, setScrapeUrl] = useState("");
    const [scrapeLoading, setScrapeLoading] = useState(false);
    const [scrapeProducts, setScrapeProducts] = useState<{ name: string; description: string; attributes: Record<string, string>; selected: boolean }[]>([]);
    const [scrapeStep, setScrapeStep] = useState(1); // 1=url, 2=preview, 3=confirm
    const [scrapeImporting, setScrapeImporting] = useState(false);
    const [scrapeResult, setScrapeResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);
    const [scrapeError, setScrapeError] = useState("");

    const importFileRef = useRef<HTMLInputElement>(null);

    /* ── Error state ────────────────────────────────── */
    const [error, setError] = useState<string | null>(null);

    /* ── Fetch items ────────────────────────────────── */
    const fetchItems = useCallback(async () => {
        if (!organization) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/products?org_id=${organization.id}`);
            const json = await res.json();
            setItems(json.data || []);
        } catch (err) {
            console.error("Failed to load products:", err);
            setError("No se pudieron cargar los productos. Intenta de nuevo.");
        }
        setLoading(false);
    }, [organization]);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    /* ── Stats ──────────────────────────────────────── */
    const stats = {
        total: items.length,
        active: items.filter(p => (p.status || "active") === "active").length,
        inactive: items.filter(p => p.status === "inactive").length,
        archived: items.filter(p => p.status === "archived").length,
    };

    /* ── Filtered & Sorted ──────────────────────────── */
    const filtered = items
        .filter(p =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.description.toLowerCase().includes(search.toLowerCase())
        )
        .filter(p => statusFilter === "all" ? true : (p.status || "active") === statusFilter)
        .sort((a, b) => {
            const dir = sortDir === "asc" ? 1 : -1;
            if (sortBy === "name") return dir * a.name.localeCompare(b.name);
            if (sortBy === "price") return dir * ((Number(a.attributes?.precio) || 0) - (Number(b.attributes?.precio) || 0));
            if (sortBy === "status") return dir * ((a.status || "active").localeCompare(b.status || "active"));
            return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });

    /* ── Open modal ────────────────────────────────── */
    const initQuickFields = (existing: Record<string, string> = {}) => {
        const qf: Record<string, string> = {};
        industryFields.forEach(f => { qf[f.key] = existing[f.key] ?? ""; });
        setQuickFields(qf);
    };

    const openCreate = () => {
        setEditItem(null); setName(""); setDescription(""); setPrice(""); setCurrency("CLP");
        initQuickFields();
        setAttrs([]); setPendingFiles([]); setExistingFiles([]);
        setFormError(""); setShowModal(true);
    };

    const openEdit = (p: CatalogItem) => {
        setEditItem(p); setName(p.name); setDescription(p.description);
        setPrice(p.attributes?.precio ?? "");
        setCurrency((p.attributes?.moneda === "UF" ? "UF" : "CLP") as "CLP" | "UF");
        initQuickFields(p.attributes ?? {});
        const reservedKeys = new Set([...industryFields.map(f => f.key), "precio", "moneda"]);
        setAttrs(Object.entries(p.attributes || {})
            .filter(([k]) => !reservedKeys.has(k))
            .map(([key, value]) => ({ key, value })));
        setExistingFiles(p.product_files || []); setPendingFiles([]);
        setFormError(""); setShowModal(true);
    };

    /* ── Save item ──────────────────────────────────── */
    const handleSave = async () => {
        if (!name.trim()) { setFormError("El nombre es obligatorio"); return; }
        setSaving(true); setFormError("");

        const attributes: Record<string, string> = {};
        if (price.trim()) { attributes["precio"] = price.trim(); attributes["moneda"] = currency; }
        Object.entries(quickFields).forEach(([k, v]) => { if (v.trim()) attributes[k] = v.trim(); });
        attrs.forEach(a => { if (a.key.trim()) attributes[a.key.trim()] = a.value; });

        try {
            const method = editItem ? "PUT" : "POST";
            const url = editItem ? `/api/products/${editItem.id}` : "/api/products";
            const body: any = { name, description, attributes, organization_id: organization.id };

            const res = await fetch(url, {
                method, headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Error al guardar");
            }
            const { data: product } = await res.json();

            for (const file of pendingFiles) {
                const fd = new FormData();
                fd.append("file", file);
                fd.append("product_id", product.id);
                await fetch("/api/files", { method: "POST", body: fd });
            }

            setShowModal(false);
            fetchItems();
        } catch (err: any) {
            setFormError(err.message);
        }
        setSaving(false);
    };

    /* ── Delete item ────────────────────────────────── */
    const handleDelete = async (id: string) => {
        if (!confirm(`¿Eliminar este ${itemLabel.toLowerCase()}?`)) return;
        await fetch(`/api/products/${id}`, { method: "DELETE" });
        fetchItems();
    };

    /* ── Delete file ────────────────────────────────── */
    const handleDeleteFile = async (fileId: string) => {
        await fetch(`/api/files?id=${fileId}`, { method: "DELETE" });
        setExistingFiles(f => f.filter(x => x.id !== fileId));
    };

    /* ── Drag & Drop ────────────────────────────────── */
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(
            f => f.type.startsWith("image/") || f.type === "application/pdf"
        );
        setPendingFiles(prev => [...prev, ...files]);
    };

    /* ── Bulk actions ───────────────────────────────── */
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleBulkStatusChange = async (newStatus: string) => {
        for (const id of selectedIds) {
            await fetch(`/api/products/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
        }
        setSelectedIds(new Set());
        setBulkMode(false);
        fetchItems();
    };

    const handleBulkDelete = async () => {
        if (!confirm(`¿Eliminar ${selectedIds.size} items?`)) return;
        for (const id of selectedIds) {
            await fetch(`/api/products/${id}`, { method: "DELETE" });
        }
        setSelectedIds(new Set());
        setBulkMode(false);
        fetchItems();
    };

    const handleExportCSV = () => {
        const headers = ["Nombre", "Descripcion", "Precio", "Moneda", "Estado", "Fecha"];
        const rows = filtered.map(p => [
            p.name,
            p.description,
            p.attributes?.precio || "",
            p.attributes?.moneda || "CLP",
            p.status || "active",
            fmtDate(p.created_at),
        ]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `inventario_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ── Import: download template CSV ──────────────── */
    const handleDownloadTemplate = () => {
        const headers = ["Nombre", "Descripción", "Precio", "Moneda"];
        industryFields.forEach(f => headers.push(f.label));

        // Dynamic example data per industry
        const examples: Record<string, { row1: string[]; row2: string[]; fields: Record<string, [string, string]> }> = {
            real_estate: {
                row1: ["Departamento Centro", "Amplio departamento de 3 dormitorios con vista al parque", "150000000", "CLP"],
                row2: ["Casa Las Condes", "Casa familiar con jardín y piscina", "8500", "UF"],
                fields: { operacion: ["Arriendo", "Venta"], habitaciones: ["3", "4"], banos: ["2", "3"], superficie: ["75", "120"], disponibilidad: ["Disponible", "Reservado"] },
            },
            hair_salon: {
                row1: ["Corte de cabello", "Corte clásico con lavado y secado", "15000", "CLP"],
                row2: ["Tinte completo", "Tinte completo con tratamiento hidratante", "45000", "CLP"],
                fields: { duracion: ["30", "90"], disponibilidad: ["Disponible", "Disponible"] },
            },
            ecommerce: {
                row1: ["Polera Premium", "Polera de algodón 100% diseño exclusivo", "25000", "CLP"],
                row2: ["Zapatillas Running", "Zapatillas deportivas con amortiguación", "89990", "CLP"],
                fields: { stock: ["50", "12"], tallas: ["S, M, L, XL", "38, 39, 40, 41, 42"] },
            },
            blank: {
                row1: ["Producto ejemplo 1", "Descripción del producto o servicio", "10000", "CLP"],
                row2: ["Producto ejemplo 2", "Otra descripción detallada", "25000", "CLP"],
                fields: { stock: ["100", "50"], categoria: ["General", "Premium"] },
            },
        };
        const ex = examples[industryId] || examples.blank;
        const row1 = [...ex.row1];
        const row2 = [...ex.row2];
        industryFields.forEach(f => {
            const vals = ex.fields[f.key];
            row1.push(vals ? vals[0] : "");
            row2.push(vals ? vals[1] : "");
        });

        const csv = [headers, row1, row2].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "plantilla_inventario.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ── Import: reset ──────────────────────────────── */
    const resetImport = () => {
        setShowImport(false);
        setImportTab("csv");
        setCsvFile(null); setCsvHeaders([]); setCsvPreview([]); setCsvAllData([]);
        setCsvTotal(0); setCsvMapping({}); setCsvStep(1); setCsvResult(null);
        setCsvParsing(false); setCsvImporting(false);
        setScrapeUrl(""); setScrapeProducts([]); setScrapeStep(1);
        setScrapeResult(null); setScrapeError("");
        setScrapeLoading(false); setScrapeImporting(false);
        setFormError("");
    };

    /* ── Import CSV: parse file ──────────────────────── */
    const handleCsvUpload = async (file: File) => {
        setCsvFile(file);
        setCsvParsing(true);
        setCsvResult(null);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("organization_id", organization.id);
            const res = await fetch("/api/products/import", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error parseando archivo");
            setCsvHeaders(data.headers);
            setCsvPreview(data.preview);
            setCsvAllData(data.allData);
            setCsvTotal(data.total);
            // Auto-map columns that match field names (with synonyms)
            const autoMap: Record<string, string> = {};
            const fieldOptions = getMappingOptions();
            const synonyms: Record<string, string[]> = {
                // Campos base
                name: ["nombre", "name", "titulo", "título", "propiedad", "producto", "departamento", "casa", "servicio"],
                description: ["descripción", "descripcion", "description", "detalle", "detalles", "desc"],
                precio: ["precio", "price", "valor", "monto", "costo", "arriendo", "renta"],
                moneda: ["moneda", "currency", "divisa", "tipo_moneda"],
                // Inmobiliaria
                operacion: ["operación", "operacion", "tipo operación", "tipo operacion"],
                habitaciones: ["habitaciones", "dormitorios", "rooms", "bedrooms", "dorms", "habs"],
                banos: ["baños", "banos", "bathrooms"],
                superficie: ["superficie", "metros", "m2", "mt2", "metraje", "area", "área", "sqm"],
                // E-commerce + general
                stock: ["stock", "inventario", "cantidad", "unidades", "disponibles", "qty", "quantity"],
                tallas: ["tallas", "talla", "sizes", "size", "medidas"],
                categoria: ["categoría", "categoria", "category", "tipo", "rubro"],
                // Peluquería
                duracion: ["duración", "duracion", "duration", "tiempo", "minutos"],
                disponibilidad: ["disponibilidad", "availability", "estado", "disponible"],
            };
            for (const h of data.headers) {
                const lower = h.toLowerCase().trim();
                let matched = false;
                // Check synonyms first
                for (const [field, syns] of Object.entries(synonyms)) {
                    if (syns.some(s => lower === s || lower.includes(s))) {
                        autoMap[h] = field;
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    // Fallback: exact match with field options
                    for (const opt of fieldOptions) {
                        if (opt.value === "ignore") continue;
                        if (lower === opt.label.toLowerCase() || lower === opt.value.toLowerCase()) {
                            autoMap[h] = opt.value;
                            matched = true;
                            break;
                        }
                    }
                }
                if (!autoMap[h]) autoMap[h] = "ignore";
            }
            setCsvMapping(autoMap);
            setCsvStep(2);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error";
            setFormError(msg);
        } finally {
            setCsvParsing(false);
        }
    };

    /* ── Import CSV: confirm ─────────────────────────── */
    const handleCsvImport = async () => {
        if (!csvMapping || !csvAllData.length) return;
        // Check that at least one column is mapped to "name"
        const nameCol = Object.entries(csvMapping).find(([, v]) => v === "name")?.[0];
        if (!nameCol) { setFormError("Debes mapear al menos una columna a 'Nombre'"); return; }
        setCsvImporting(true);
        setCsvResult(null);
        try {
            // Build products from data + mapping
            const products = csvAllData.map(row => {
                const p: { name: string; description: string; attributes: Record<string, string> } = {
                    name: "", description: "", attributes: {},
                };
                for (const [col, field] of Object.entries(csvMapping)) {
                    if (field === "ignore" || !row[col]) continue;
                    const val = String(row[col]).trim();
                    if (!val) continue;
                    if (field === "name") p.name = val;
                    else if (field === "description") p.description = val;
                    else p.attributes[field] = val;
                }
                return p;
            }).filter(p => p.name.trim().length > 0);

            const res = await fetch("/api/products/import/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ organization_id: organization.id, products }),
            });
            const data = await res.json();
            setCsvResult({ imported: data.imported || 0, failed: data.failed || 0, errors: data.errors || [] });
            setCsvStep(3);
            if (data.imported > 0) fetchItems();
        } catch {
            setCsvResult({ imported: 0, failed: csvTotal, errors: ["Error de conexión"] });
            setCsvStep(3);
        } finally {
            setCsvImporting(false);
        }
    };

    /* ── Scrape: analyze URL ─────────────────────────── */
    const handleScrape = async () => {
        if (!scrapeUrl.trim()) return;
        setScrapeLoading(true);
        setScrapeError("");
        setScrapeProducts([]);
        setScrapeResult(null);
        try {
            const res = await fetch("/api/products/scrape", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: scrapeUrl, organization_id: organization.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error analizando página");
            if (!data.products || data.products.length === 0) {
                setScrapeError(`No se encontraron ${itemLabel.toLowerCase()}s en esta página. Intenta con otra URL.`);
                return;
            }
            setScrapeProducts(data.products.map((p: { name: string; description?: string; attributes?: Record<string, string> }) => ({
                ...p, description: p.description || "", attributes: p.attributes || {}, selected: true,
            })));
            setScrapeStep(2);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error";
            setScrapeError(msg);
        } finally {
            setScrapeLoading(false);
        }
    };

    /* ── Scrape: import selected ─────────────────────── */
    const handleScrapeImport = async () => {
        const selected = scrapeProducts.filter(p => p.selected);
        if (selected.length === 0) return;
        setScrapeImporting(true);
        setScrapeResult(null);
        try {
            const products = selected.map(p => ({
                name: p.name,
                description: p.description,
                attributes: p.attributes,
            }));
            const res = await fetch("/api/products/import/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ organization_id: organization.id, products }),
            });
            const data = await res.json();
            setScrapeResult({ imported: data.imported || 0, failed: data.failed || 0, errors: data.errors || [] });
            setScrapeStep(3);
            if (data.imported > 0) fetchItems();
        } catch {
            setScrapeResult({ imported: 0, failed: selected.length, errors: ["Error de conexión"] });
            setScrapeStep(3);
        } finally {
            setScrapeImporting(false);
        }
    };

    /* ── Mapping options for CSV columns ──────────────── */
    const getMappingOptions = () => {
        const opts = [
            { value: "name", label: "Nombre" },
            { value: "description", label: "Descripción" },
            { value: "precio", label: "Precio" },
            { value: "moneda", label: "Moneda (CLP/UF)" },
            ...industryFields.map(f => ({ value: f.key, label: f.label })),
            { value: "ignore", label: "— Ignorar —" },
        ];
        return opts;
    };

    const toggleSort = (field: typeof sortBy) => {
        if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortBy(field); setSortDir("asc"); }
    };

    /* ── Render ─────────────────────────────────────── */
    const statusS = (s: string) => statusConfig[s] || statusConfig.active;

    return (
        <div className="animate-in">
            {error && (
                <div style={{ background: "rgba(239,68,68,0.08)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "12px 16px", margin: "0 0 12px 0", color: "#f87171", fontSize: 14 }}>
                    {error}
                </div>
            )}
            {/* ── Header ───────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Inventario</h1>
                    <p className="page-subtitle">
                        El bot usa este catálogo en cada conversación
                    </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2"
                        style={{ fontSize: "0.82rem", backdropFilter: "blur(8px)", borderColor: "rgba(122,158,138,0.15)" }}>
                        <Upload size={15} /> Importar
                    </button>
                    <button onClick={openCreate} className="btn-primary">
                        <Plus size={18} /> {itemNew}
                    </button>
                </div>
            </div>

            {/* ── KPI Stats ────────────────────────── */}
            {items.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px", marginBottom: "24px" }}>
                    {[
                        { label: "Total", value: stats.total, icon: Package, color: "#7a9e8a", bg: "rgba(122,158,138,0.08)" },
                        { label: "Activos", value: stats.active, icon: Eye, color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
                        { label: "Inactivos", value: stats.inactive, icon: EyeOff, color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
                        { label: "Archivados", value: stats.archived, icon: Archive, color: "#52525b", bg: "rgba(82,82,91,0.12)" },
                    ].map(kpi => (
                        <div key={kpi.label} className="kpi-card">
                            <div style={{
                                width: "36px", height: "36px", borderRadius: "10px",
                                background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                                <kpi.icon size={17} style={{ color: kpi.color }} />
                            </div>
                            <div>
                                <div className="kpi-value font-display dashboard-stat" style={{ color: "var(--text-primary)" }}>{kpi.value}</div>
                                <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{kpi.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Toolbar ──────────────────────────── */}
            {items.length > 0 && (
                <div className="glass-panel" style={{
                    display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px",
                    marginBottom: "20px", padding: "14px 18px",
                    borderRadius: "14px",
                }}>
                    {/* Search */}
                    <div style={{ position: "relative", flex: "1 1 200px", maxWidth: "300px" }}>
                        <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                        <input className="input" placeholder={`Buscar ${itemLabel.toLowerCase()}s...`}
                            value={search} onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: "36px", padding: "8px 12px 8px 36px", fontSize: "0.8rem" }} />
                    </div>

                    {/* Status filter pills */}
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                        <Filter size={13} style={{ color: "var(--text-muted)", marginRight: "4px" }} />
                        {(["all", "active", "inactive", "archived"] as const).map(val => {
                            const count = val === "all" ? items.length : stats[val];
                            const labels: Record<string, string> = { all: "Todos", active: "Activos", inactive: "Inactivos", archived: "Archivados" };
                            return (
                                <button key={val} onClick={() => setStatusFilter(val)}
                                    className={`filter-pill${statusFilter === val ? " active" : ""}`}>
                                    {labels[val]} <span style={{ opacity: 0.5 }}>{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Separator */}
                    <div style={{ width: "1px", height: "24px", background: "var(--border)", margin: "0 4px" }} />

                    {/* Sort */}
                    <button onClick={() => toggleSort(sortBy === "date" ? "name" : sortBy === "name" ? "price" : "date")}
                        className="btn-secondary" style={{ padding: "6px 12px", fontSize: "0.7rem", gap: "4px" }}>
                        <ArrowUpDown size={13} />
                        {sortBy === "date" ? "Fecha" : sortBy === "name" ? "Nombre" : sortBy === "price" ? "Precio" : "Status"}
                    </button>

                    {/* View toggle */}
                    <div style={{ display: "flex", border: "0.5px solid var(--border)", borderRadius: "10px", overflow: "hidden", background: "rgba(0,0,0,0.15)" }}>
                        <button onClick={() => setViewMode("grid")} style={{
                            padding: "6px 12px", background: viewMode === "grid" ? "rgba(122,158,138,0.12)" : "transparent",
                            border: "none", cursor: "pointer", display: "flex", alignItems: "center",
                            color: viewMode === "grid" ? "var(--accent-light)" : "var(--text-muted)",
                            transition: "all 0.15s ease",
                        }}><LayoutGrid size={15} /></button>
                        <button onClick={() => setViewMode("table")} style={{
                            padding: "6px 12px", background: viewMode === "table" ? "rgba(122,158,138,0.12)" : "transparent",
                            border: "none", borderLeft: "0.5px solid var(--border)", cursor: "pointer",
                            display: "flex", alignItems: "center",
                            color: viewMode === "table" ? "var(--accent-light)" : "var(--text-muted)",
                            transition: "all 0.15s ease",
                        }}><List size={15} /></button>
                    </div>

                    {/* CSV Export */}
                    <button onClick={handleExportCSV}
                        className="btn-secondary" style={{ padding: "6px 12px", fontSize: "0.7rem", gap: "4px", backdropFilter: "blur(4px)" }}>
                        <Download size={13} /> CSV
                    </button>

                    {/* Bulk toggle */}
                    <button onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
                        className="btn-secondary" style={{
                            padding: "6px 12px", fontSize: "0.7rem", gap: "4px",
                            background: bulkMode ? "rgba(122,158,138,0.1)" : undefined,
                            borderColor: bulkMode ? "rgba(122,158,138,0.25)" : undefined,
                            color: bulkMode ? "#9ab8a8" : undefined,
                        }}>
                        <CheckSquare size={13} /> Seleccionar
                    </button>
                </div>
            )}

            {/* ── Bulk Action Bar ──────────────────── */}
            <AnimatePresence>
                {bulkMode && selectedIds.size > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                        className="glass-panel"
                        style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            padding: "12px 20px", marginBottom: "16px",
                            background: "rgba(122,158,138,0.04)",
                            border: "0.5px solid rgba(122,158,138,0.2)",
                            borderRadius: "14px",
                            backdropFilter: "blur(12px)",
                            boxShadow: "0 0 20px rgba(122,158,138,0.04)",
                        }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#9ab8a8" }}>
                            {selectedIds.size} seleccionado{selectedIds.size > 1 ? "s" : ""}
                        </span>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => handleBulkStatusChange("active")}
                            style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 600, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "0.5px solid rgba(34,197,94,0.2)", cursor: "pointer" }}>
                            <Eye size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} />Activar
                        </button>
                        <button onClick={() => handleBulkStatusChange("inactive")}
                            style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 600, background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "0.5px solid rgba(245,158,11,0.2)", cursor: "pointer" }}>
                            <EyeOff size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} />Desactivar
                        </button>
                        <button onClick={() => handleBulkStatusChange("archived")}
                            style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 600, background: "rgba(82,82,91,0.12)", color: "var(--text-secondary)", border: "0.5px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
                            <Archive size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} />Archivar
                        </button>
                        <button onClick={handleBulkDelete}
                            style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 600, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "0.5px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>
                            <Trash2 size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} />Eliminar
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Loading ──────────────────────────── */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                </div>
            )}

            {/* ── Empty state ──────────────────────── */}
            {!loading && items.length === 0 && (
                <div className="empty-state glass-card p-0 overflow-hidden">
                    <div className="flex flex-col items-center justify-center py-20 px-8">
                        <motion.div
                            animate={{ y: [0, -6, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            className="flex items-center justify-center w-20 h-20 rounded-3xl mb-6"
                            style={{ background: "rgba(122,158,138,0.1)", border: "1px dashed rgba(122,158,138,0.25)", boxShadow: "0 0 30px rgba(122,158,138,0.08)" }}>
                            <Package size={36} style={{ color: "var(--accent-light)", opacity: 0.8, filter: "drop-shadow(0 0 8px rgba(122,158,138,0.3))" }} />
                        </motion.div>
                        <h3 className="text-lg mb-2 font-display" style={{ color: "var(--text-primary)", fontWeight: 600, fontFamily: "'Playfair Display', serif" }}>
                            Sin {itemLabel.toLowerCase()}s todavia
                        </h3>
                        <p className="text-sm mb-6 text-center max-w-sm" style={{ color: "var(--text-secondary)" }}>
                            Registra tu primer {itemLabel.toLowerCase()} para que el agente AI pueda responder consultas
                            con informacion precisa de tu catalogo.
                        </p>
                        <button onClick={openCreate} className="btn-primary">
                            <Plus size={18} /> Crear {itemFirst}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Grid View ──────────────────────────── */}
            {!loading && filtered.length > 0 && viewMode === "grid" && (
                <div className="grid-products">
                    <AnimatePresence mode="popLayout">
                        {filtered.map((p, idx) => {
                            const imgFile = p.product_files?.find(f => f.file_type === "image");
                            const hasEmbedding = !!p.embedding;
                            const st = statusS(p.status || "active");
                            return (
                                <motion.div key={p.id}
                                    layout
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3, delay: idx * 0.04 }}
                                    className="glass-card card-hover-lift overflow-hidden cursor-pointer animate-in"
                                    style={{ position: "relative", animationDelay: `${idx * 40}ms` }}
                                    onClick={() => setViewItem(p)}>

                                    {/* Bulk checkbox */}
                                    {bulkMode && (
                                        <div onClick={e => { e.stopPropagation(); toggleSelect(p.id); }}
                                            style={{ position: "absolute", top: "10px", left: "10px", zIndex: 3, cursor: "pointer" }}>
                                            {selectedIds.has(p.id) ?
                                                <CheckSquare size={20} style={{ color: "#7a9e8a" }} /> :
                                                <Square size={20} style={{ color: "var(--text-muted)" }} />}
                                        </div>
                                    )}

                                    {/* Status dot */}
                                    {!bulkMode && (
                                        <div style={{
                                            position: "absolute", top: "12px", left: "12px", zIndex: 2,
                                            width: "9px", height: "9px", borderRadius: "50%",
                                            background: st.dot,
                                            boxShadow: st.glow || "none",
                                        }} />
                                    )}

                                    {/* Image */}
                                    <div className="h-40 flex items-center justify-center relative overflow-hidden"
                                        style={{ background: "var(--bg-secondary)" }}>
                                        {imgFile ? (
                                            <img src={imgFile.file_url} alt={p.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <Package size={40} style={{ color: "var(--text-muted)", opacity: 0.3 }} />
                                        )}
                                        <div className="absolute top-3 right-3" style={{ display: "flex", gap: "4px" }}>
                                            <span style={{
                                                padding: "3px 9px", borderRadius: "100px",
                                                fontSize: "0.6rem", fontWeight: 700,
                                                background: st.bg, color: st.color,
                                            }}>{st.label}</span>
                                            <span className={`badge ${hasEmbedding ? "badge-active" : "badge-inactive"}`}
                                                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.6rem", padding: "3px 9px" }}>
                                                {hasEmbedding ? "Vectorizado" : "Pendiente"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-5">
                                        <h3 className="text-sm mb-1 truncate" style={{ color: "var(--text-primary)", fontWeight: 700, letterSpacing: "-0.01em" }}>{p.name}</h3>
                                        {p.attributes?.precio && (
                                            <p className="text-base mb-1 font-display" style={{ color: "var(--accent-light)", fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>
                                                {fmtPrice(p.attributes.precio, p.attributes?.moneda)}
                                            </p>
                                        )}
                                        <p className="text-xs line-clamp-2 mb-3" style={{ color: "var(--text-secondary)" }}>
                                            {p.description || "Sin descripcion"}
                                        </p>
                                        {Object.keys(p.attributes || {}).length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                {Object.entries(p.attributes).filter(([k]) => k !== "precio" && k !== "moneda").slice(0, 3).map(([k, v]) => (
                                                    <span key={k} className="text-[0.65rem] px-2 py-0.5 rounded-full"
                                                        style={{ background: "rgba(122,158,138,0.06)", color: "var(--text-secondary)", border: "0.5px solid rgba(122,158,138,0.1)" }}>
                                                        <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{k}:</span> {v}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between pt-3"
                                            style={{ borderTop: "0.5px solid var(--border)" }}>
                                            <span className="text-[0.65rem]" style={{ color: "var(--text-muted)" }}>
                                                {fmtDate(p.created_at)}
                                            </span>
                                            <div className="flex gap-1">
                                                <button onClick={e => { e.stopPropagation(); openEdit(p); }}
                                                    className="btn-secondary" style={{ padding: "6px 12px", fontSize: "0.7rem" }}>
                                                    Editar
                                                </button>
                                                <button onClick={e => { e.stopPropagation(); handleDelete(p.id); }}
                                                    className="btn-danger" style={{ padding: "6px 10px" }}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* ── Table View ─────────────────────────── */}
            {!loading && filtered.length > 0 && viewMode === "table" && (
                <div className="glass-card" style={{ overflow: "hidden", padding: 0 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
                                {bulkMode && (
                                    <th className="table-header-cell" style={{ width: "40px", paddingLeft: "16px" }}>
                                        <button onClick={() => {
                                            if (selectedIds.size === filtered.length) setSelectedIds(new Set());
                                            else setSelectedIds(new Set(filtered.map(p => p.id)));
                                        }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                                            {selectedIds.size === filtered.length ?
                                                <CheckSquare size={16} style={{ color: "#7a9e8a" }} /> :
                                                <Square size={16} style={{ color: "var(--text-muted)" }} />}
                                        </button>
                                    </th>
                                )}
                                <th className="table-header-cell" style={{ cursor: "pointer" }} onClick={() => toggleSort("name")}>
                                    Nombre {sortBy === "name" && (sortDir === "asc" ? "↑" : "↓")}
                                </th>
                                <th className="table-header-cell" style={{ cursor: "pointer" }} onClick={() => toggleSort("price")}>
                                    Precio {sortBy === "price" && (sortDir === "asc" ? "↑" : "↓")}
                                </th>
                                <th className="table-header-cell" style={{ cursor: "pointer" }} onClick={() => toggleSort("status")}>
                                    Estado {sortBy === "status" && (sortDir === "asc" ? "↑" : "↓")}
                                </th>
                                <th className="table-header-cell">Vectorizado</th>
                                <th className="table-header-cell" style={{ cursor: "pointer" }} onClick={() => toggleSort("date")}>
                                    Fecha {sortBy === "date" && (sortDir === "asc" ? "↑" : "↓")}
                                </th>
                                <th className="table-header-cell" style={{ textAlign: "right", paddingRight: "16px" }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence>
                                {filtered.map((p) => {
                                    const st = statusS(p.status || "active");
                                    const hasEmb = !!p.embedding;
                                    return (
                                        <motion.tr key={p.id}
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="table-row" style={{ cursor: "pointer" }}
                                            onClick={() => setViewItem(p)}>
                                            {bulkMode && (
                                                <td className="table-cell" style={{ paddingLeft: "16px" }} onClick={e => { e.stopPropagation(); toggleSelect(p.id); }}>
                                                    {selectedIds.has(p.id) ?
                                                        <CheckSquare size={16} style={{ color: "#7a9e8a" }} /> :
                                                        <Square size={16} style={{ color: "var(--text-muted)" }} />}
                                                </td>
                                            )}
                                            <td className="table-cell">
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                    <div style={{
                                                        width: "8px", height: "8px", borderRadius: "50%",
                                                        background: st.dot, boxShadow: st.glow || "none", flexShrink: 0,
                                                    }} />
                                                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                                                </div>
                                            </td>
                                            <td className="table-cell" style={{ color: p.attributes?.precio ? "var(--accent-light)" : "var(--text-muted)", fontFamily: p.attributes?.precio ? "'Playfair Display', serif" : "inherit", fontWeight: p.attributes?.precio ? 600 : 400 }}>
                                                {p.attributes?.precio ? fmtPrice(p.attributes.precio, p.attributes?.moneda) : "—"}
                                            </td>
                                            <td className="table-cell">
                                                <span style={{
                                                    padding: "3px 10px", borderRadius: "100px",
                                                    fontSize: "0.68rem", fontWeight: 600,
                                                    background: st.bg, color: st.color,
                                                }}>{st.label}</span>
                                            </td>
                                            <td className="table-cell">
                                                <span style={{ color: hasEmb ? "var(--success)" : "var(--text-muted)", fontSize: "0.8rem" }}>
                                                    {hasEmb ? "✓" : "⏳"}
                                                </span>
                                            </td>
                                            <td className="table-cell" style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                                                {fmtDate(p.created_at)}
                                            </td>
                                            <td className="table-cell" style={{ textAlign: "right", paddingRight: "16px" }}>
                                                <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end", opacity: 0.6, transition: "opacity 0.15s ease" }}
                                                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                                                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = "0.6"; }}>
                                                    <button onClick={e => { e.stopPropagation(); openEdit(p); }}
                                                        style={{
                                                            padding: "6px 10px", borderRadius: "8px",
                                                            background: "rgba(122,158,138,0.06)", backdropFilter: "blur(4px)",
                                                            border: "0.5px solid rgba(122,158,138,0.12)", cursor: "pointer", display: "flex", color: "var(--accent-light)",
                                                            transition: "all 0.15s ease",
                                                        }}><Edit3 size={13} /></button>
                                                    <button onClick={e => { e.stopPropagation(); handleDelete(p.id); }}
                                                        style={{
                                                            padding: "6px 10px", borderRadius: "8px",
                                                            background: "rgba(239,68,68,0.06)", backdropFilter: "blur(4px)",
                                                            border: "0.5px solid rgba(239,68,68,0.12)", cursor: "pointer", display: "flex", color: "#f87171",
                                                            transition: "all 0.15s ease",
                                                        }}><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── No results ─────────────────────────── */}
            {!loading && items.length > 0 && filtered.length === 0 && (
                <div className="glass-card" style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                    <Search size={32} style={{ margin: "0 auto 12px", opacity: 0.3, filter: "drop-shadow(0 0 6px rgba(122,158,138,0.2))" }} />
                    <p style={{ fontSize: "0.88rem", fontWeight: 500 }}>Sin resultados para esta busqueda o filtro</p>
                </div>
            )}

            {/* ── VIEW Modal (Premium) ─────────────── */}
            {viewItem && (() => {
                const vSt = statusConfig[viewItem.status || "active"] || statusConfig.active;
                const vImg = viewItem.product_files?.find(f => f.file_type === "image");
                const vHasEmb = viewItem.embedding && (Array.isArray(viewItem.embedding) ? viewItem.embedding.length > 0 : true);
                const vAttrs = Object.entries(viewItem.attributes || {}).filter(([k]) => k !== "moneda" && k !== "precio");
                const vDisp = viewItem.attributes?.disponibilidad;
                const dispColor = !vDisp ? null : vDisp === "Disponible" ? "#22c55e" : vDisp === "Reservado" ? "#f59e0b" : vDisp === "Vendido" || vDisp === "Arrendado" ? "#ef4444" : vDisp === "No Disponible" ? "#ef4444" : "#6366f1";

                return (
                <div className="modal-overlay animate-in" onClick={() => setViewItem(null)}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="modal-content" onClick={e => e.stopPropagation()}
                        style={{ maxWidth: "580px", padding: 0, overflow: "hidden", borderRadius: "18px" }}>

                        {/* Hero image / placeholder */}
                        <div style={{
                            height: vImg ? "220px" : "120px",
                            background: vImg ? "transparent" : "linear-gradient(135deg, rgba(122,158,138,0.08) 0%, rgba(93,130,112,0.08) 100%)",
                            position: "relative", overflow: "hidden",
                        }}>
                            {vImg ? (
                                <img src={vImg.file_url} alt={viewItem.name}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                                    <Package size={48} style={{ color: "var(--text-muted)", opacity: 0.2 }} />
                                </div>
                            )}
                            {/* Gradient overlay */}
                            <div style={{
                                position: "absolute", bottom: 0, left: 0, right: 0, height: "80px",
                                background: "linear-gradient(transparent, var(--bg-card))",
                            }} />
                            {/* Close button */}
                            <button onClick={() => setViewItem(null)} style={{
                                position: "absolute", top: "12px", right: "12px", zIndex: 3,
                                width: "32px", height: "32px", borderRadius: "10px",
                                background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
                                border: "0.5px solid rgba(255,255,255,0.1)",
                                color: "#fff", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                                <X size={16} />
                            </button>
                            {/* Badges top-left */}
                            <div style={{ position: "absolute", top: "12px", left: "12px", display: "flex", gap: "6px", zIndex: 3 }}>
                                <span style={{
                                    padding: "4px 10px", borderRadius: "100px",
                                    fontSize: "0.65rem", fontWeight: 700,
                                    background: vSt.bg, color: vSt.color,
                                    backdropFilter: "blur(8px)",
                                    border: `0.5px solid ${vSt.color}22`,
                                }}>{vSt.label}</span>
                                {vHasEmb && (
                                    <span style={{
                                        padding: "4px 10px", borderRadius: "100px",
                                        fontSize: "0.65rem", fontWeight: 700,
                                        background: "rgba(34,197,94,0.1)", color: "#22c55e",
                                        backdropFilter: "blur(8px)",
                                        border: "0.5px solid rgba(34,197,94,0.15)",
                                    }}>✓ IA Ready</span>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div style={{ padding: "20px 24px 24px" }}>
                            {/* Title + Price */}
                            <div style={{ marginBottom: "16px" }}>
                                <h2 style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.01em" }}>
                                    {viewItem.name}
                                </h2>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                    {viewItem.attributes?.precio && (
                                        <span style={{
                                            fontSize: "1.15rem", fontWeight: 700,
                                            color: "var(--accent-light)",
                                            fontFamily: "'Playfair Display', serif",
                                        }}>
                                            {fmtPrice(viewItem.attributes.precio, viewItem.attributes?.moneda)}
                                        </span>
                                    )}
                                    {viewItem.attributes?.precio && (
                                        <span style={{
                                            padding: "2px 8px", borderRadius: "6px",
                                            fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.5px",
                                            background: viewItem.attributes?.moneda === "UF" ? "rgba(167,139,250,0.1)" : "rgba(122,158,138,0.1)",
                                            color: viewItem.attributes?.moneda === "UF" ? "#a78bfa" : "#9ab8a8",
                                            border: `0.5px solid ${viewItem.attributes?.moneda === "UF" ? "rgba(167,139,250,0.15)" : "rgba(122,158,138,0.15)"}`,
                                        }}>
                                            {viewItem.attributes?.moneda || "CLP"}
                                        </span>
                                    )}
                                    {vDisp && (
                                        <span style={{
                                            padding: "2px 8px", borderRadius: "6px",
                                            fontSize: "0.6rem", fontWeight: 700,
                                            background: `${dispColor}15`,
                                            color: dispColor || "var(--text-muted)",
                                            border: `0.5px solid ${dispColor}25`,
                                        }}>
                                            {vDisp}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Description */}
                            {viewItem.description && (
                                <p style={{
                                    fontSize: "0.82rem", lineHeight: 1.65, color: "var(--text-secondary)",
                                    marginBottom: "18px",
                                }}>
                                    {viewItem.description}
                                </p>
                            )}

                            {/* Attributes grid */}
                            {vAttrs.length > 0 && (
                                <div style={{ marginBottom: "18px" }}>
                                    <p style={{
                                        fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)",
                                        textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px",
                                    }}>Detalles</p>
                                    <div style={{
                                        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                                        gap: "8px",
                                    }}>
                                        {vAttrs.map(([k, v]) => (
                                            <div key={k} className="glass-panel" style={{
                                                padding: "10px 14px", borderRadius: "12px",
                                            }}>
                                                <p style={{
                                                    fontSize: "0.62rem", fontWeight: 600, color: "var(--text-muted)",
                                                    textTransform: "capitalize", marginBottom: "3px",
                                                }}>{k.replace(/_/g, " ")}</p>
                                                <p style={{
                                                    fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)",
                                                }}>{v}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Image gallery */}
                            {viewItem.product_files && viewItem.product_files.length > 0 && (
                                <div style={{ marginBottom: "18px" }}>
                                    <p style={{
                                        fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)",
                                        textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px",
                                    }}>Archivos</p>
                                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                        {viewItem.product_files.map(f => (
                                            <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer"
                                                style={{
                                                    width: "80px", height: "80px", borderRadius: "12px",
                                                    overflow: "hidden", border: "0.5px solid var(--border)",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    background: "var(--bg-secondary)", textDecoration: "none",
                                                    transition: "all 0.15s ease",
                                                }}>
                                                {f.file_type === "image" ? (
                                                    <img src={f.file_url} alt={f.file_name}
                                                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                ) : (
                                                    <div style={{ textAlign: "center" }}>
                                                        <FileText size={20} style={{ color: "var(--warning)", margin: "0 auto 4px" }} />
                                                        <p style={{ fontSize: "0.55rem", color: "var(--text-muted)" }}>
                                                            {f.file_name.length > 10 ? f.file_name.slice(0, 10) + "…" : f.file_name}
                                                        </p>
                                                    </div>
                                                )}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Footer info */}
                            <div style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                paddingTop: "16px", borderTop: "0.5px solid var(--border)",
                            }}>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                    Creado el {fmtDate(viewItem.created_at)}
                                </span>
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <button onClick={() => {
                                        if (!confirm(`¿Eliminar este ${itemLabel.toLowerCase()}?`)) return;
                                        fetch(`/api/products/${viewItem.id}`, { method: "DELETE" }).then(() => fetchItems());
                                        setViewItem(null);
                                    }}
                                        style={{
                                            padding: "8px 14px", borderRadius: "10px", fontSize: "0.78rem", fontWeight: 600,
                                            background: "rgba(239,68,68,0.06)", border: "0.5px solid rgba(239,68,68,0.12)",
                                            color: "#f87171", cursor: "pointer",
                                            display: "flex", alignItems: "center", gap: "6px",
                                            transition: "all 0.15s ease",
                                        }}>
                                        <Trash2 size={14} /> Eliminar
                                    </button>
                                    <button onClick={() => { setViewItem(null); openEdit(viewItem); }}
                                        style={{
                                            padding: "8px 18px", borderRadius: "10px", fontSize: "0.78rem", fontWeight: 600,
                                            background: "rgba(122,158,138,0.1)", border: "0.5px solid rgba(122,158,138,0.2)",
                                            color: "#9ab8a8", cursor: "pointer",
                                            display: "flex", alignItems: "center", gap: "6px",
                                            transition: "all 0.15s ease",
                                        }}>
                                        <Edit3 size={14} /> Editar {itemLabel.toLowerCase()}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
                );
            })()}

            {/* ── CREATE / EDIT Modal ──────────────── */}
            {showModal && (
                <div className="modal-overlay animate-in" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "640px" }}>
                        <div className="modal-header mb-2">
                            <h2 className="text-lg" style={{ color: "var(--text-primary)", fontFamily: "'Playfair Display', serif", fontWeight: 600 }}>
                                {editItem ? `Editar ${itemLabel}` : itemNew}
                            </h2>
                            <button onClick={() => setShowModal(false)}
                                className="p-1 rounded-lg transition-colors hover:bg-white/5 cursor-pointer"
                                style={{ background: "none", border: "none", color: "var(--text-muted)" }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body space-y-5">
                            {formError && (
                                <div className="p-3 rounded-lg text-sm"
                                    style={{ background: "rgba(239,68,68,0.1)", border: "0.5px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                                    {formError}
                                </div>
                            )}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Nombre *</label>
                                <input className="input" placeholder={`Ej: ${itemLabel} destacado`}
                                    value={name} onChange={e => setName(e.target.value)} autoFocus />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Precio</label>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <div style={{
                                        display: "flex", borderRadius: "8px", overflow: "hidden",
                                        border: "0.5px solid var(--border)", flexShrink: 0,
                                    }}>
                                        {(["CLP", "UF"] as const).map(c => (
                                            <button key={c} type="button" onClick={() => setCurrency(c)}
                                                style={{
                                                    padding: "8px 12px", fontSize: "0.78rem", fontWeight: 700,
                                                    border: "none", cursor: "pointer",
                                                    background: currency === c ? (c === "CLP" ? "rgba(122,158,138,0.12)" : "rgba(167,139,250,0.12)") : "transparent",
                                                    color: currency === c ? (c === "CLP" ? "#9ab8a8" : "#a78bfa") : "var(--text-muted)",
                                                    transition: "all 0.15s ease",
                                                }}>
                                                {c === "CLP" ? "CLP" : "UF"}
                                            </button>
                                        ))}
                                    </div>
                                    <input className="input" placeholder={currency === "UF" ? "Ej: 3500" : "Ej: 150000000"} type="number" min="0"
                                        step={currency === "UF" ? "0.01" : "1"}
                                        value={price} onChange={e => setPrice(e.target.value)}
                                        style={{ flex: 1 }} />
                                </div>
                                <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                    {currency === "CLP" ? "Pesos chilenos (ej: 150.000.000)" : "Unidades de Fomento (ej: 3.500,50)"}
                                </p>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Descripcion</label>
                                <textarea className="textarea" placeholder={`Describe este ${itemLabel.toLowerCase()} en detalle...`}
                                    value={description} onChange={e => setDescription(e.target.value)}
                                    rows={3} style={{ minHeight: "80px" }} />
                            </div>
                            {industryFields.length > 0 && (
                                <div className="glass-panel" style={{ padding: "16px 18px", borderRadius: "14px" }}>
                                    <label className="form-label mb-3 block" style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: "var(--text-muted)" }}>Campos de {template.label}</label>
                                    <div style={{ display: "grid", gridTemplateColumns: industryFields.length > 1 ? "1fr 1fr" : "1fr", gap: "12px" }}>
                                        {industryFields.map(field => (
                                            <div key={field.key} className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label">{field.label}</label>
                                                {field.type === "select" ? (
                                                    <select className="select"
                                                        value={quickFields[field.key] ?? ""}
                                                        onChange={e => setQuickFields(prev => ({ ...prev, [field.key]: e.target.value }))}>
                                                        <option value="">— Seleccionar —</option>
                                                        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                ) : (
                                                    <input className="input" type={field.type} placeholder={field.placeholder}
                                                        value={quickFields[field.key] ?? ""}
                                                        onChange={e => setQuickFields(prev => ({ ...prev, [field.key]: e.target.value }))} />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="form-label" style={{ marginBottom: 0 }}>Atributos Extra</label>
                                    <button type="button" onClick={() => setAttrs([...attrs, { key: "", value: "" }])}
                                        className="btn-secondary" style={{ padding: "4px 10px", fontSize: "0.7rem" }}>
                                        <Plus size={14} /> Agregar
                                    </button>
                                </div>
                                {attrs.length === 0 && (
                                    <p className="text-xs py-3 text-center rounded-lg"
                                        style={{ color: "var(--text-muted)", background: "var(--bg-card)", border: "1px dashed var(--border)" }}>
                                        Sin atributos extra
                                    </p>
                                )}
                                <div className="space-y-2.5">
                                    {attrs.map((a, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <GripVertical size={14} style={{ color: "var(--text-muted)", opacity: 0.4, flexShrink: 0 }} />
                                            <input className="input" placeholder="Clave" value={a.key} style={{ flex: 1 }}
                                                onChange={e => { const next = [...attrs]; next[i].key = e.target.value; setAttrs(next); }} />
                                            <input className="input" placeholder="Valor" value={a.value} style={{ flex: 1 }}
                                                onChange={e => { const next = [...attrs]; next[i].value = e.target.value; setAttrs(next); }} />
                                            <button onClick={() => setAttrs(attrs.filter((_, idx) => idx !== i))}
                                                className="p-1.5 rounded-lg transition-colors hover:bg-white/5 shrink-0 cursor-pointer"
                                                style={{ background: "none", border: "none", color: "var(--danger)" }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Archivos</label>
                                <div className="flex flex-col items-center justify-center p-6 rounded-xl transition-colors cursor-pointer glass-panel"
                                    style={{ border: "2px dashed rgba(122,158,138,0.15)", background: "rgba(122,158,138,0.02)" }}
                                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--accent)"; }}
                                    onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                                    onDrop={e => { e.currentTarget.style.borderColor = "var(--border)"; handleDrop(e); }}
                                    onClick={() => fileInputRef.current?.click()}>
                                    <Upload size={24} className="mb-2" style={{ color: "var(--text-muted)" }} />
                                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                        Arrastra imagenes o PDFs, o <span style={{ color: "var(--accent-light)", fontWeight: 600 }}>haz clic</span>
                                    </p>
                                    <input ref={fileInputRef} type="file" className="hidden"
                                        accept="image/*,.pdf" multiple
                                        onChange={e => { if (e.target.files) setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} />
                                </div>
                                {existingFiles.length > 0 && (
                                    <div className="mt-3 space-y-1.5">
                                        <span className="text-[0.65rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Archivos existentes</span>
                                        {existingFiles.map(f => (
                                            <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg"
                                                style={{ background: "var(--bg-secondary)", border: "0.5px solid var(--border)" }}>
                                                {f.file_type === "image" ? <ImageIcon size={14} style={{ color: "var(--info)" }} /> : <FileText size={14} style={{ color: "var(--warning)" }} />}
                                                <span className="text-xs flex-1 truncate" style={{ color: "var(--text-primary)" }}>{f.file_name}</span>
                                                <span className="text-[0.6rem]" style={{ color: "var(--text-muted)" }}>{fmtSize(f.file_size)}</span>
                                                <button onClick={() => handleDeleteFile(f.id)}
                                                    className="p-1 rounded hover:bg-white/5 cursor-pointer"
                                                    style={{ background: "none", border: "none", color: "var(--danger)" }}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {pendingFiles.length > 0 && (
                                    <div className="mt-3 space-y-1.5">
                                        <span className="text-[0.65rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Por subir</span>
                                        {pendingFiles.map((f, i) => (
                                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg"
                                                style={{ background: "var(--bg-secondary)", border: "0.5px solid rgba(255,255,255,0.06)" }}>
                                                {f.type.startsWith("image/") ? <ImageIcon size={14} style={{ color: "var(--info)" }} /> : <FileText size={14} style={{ color: "var(--warning)" }} />}
                                                <span className="text-xs flex-1 truncate" style={{ color: "var(--text-primary)" }}>{f.name}</span>
                                                <span className="text-[0.6rem]" style={{ color: "var(--text-muted)" }}>{fmtSize(f.size)}</span>
                                                <button onClick={() => setPendingFiles(pendingFiles.filter((_, idx) => idx !== i))}
                                                    className="p-1 rounded hover:bg-white/5 cursor-pointer"
                                                    style={{ background: "none", border: "none", color: "var(--danger)" }}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                            <button onClick={handleSave} className="btn-primary" disabled={saving}>
                                {saving ? <><Loader2 size={15} className="animate-spin" /> Guardando...</> : <>{editItem ? "Actualizar" : `Crear ${itemLabel.toLowerCase()}`}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── IMPORT Modal ─────────────────────────── */}
            <AnimatePresence>
                {showImport && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="modal-overlay" onClick={resetImport}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 12 }}
                            transition={{ duration: 0.2 }}
                            onClick={e => e.stopPropagation()}
                            className="modal-content"
                            style={{ maxWidth: "680px", maxHeight: "85vh", overflowY: "auto" }}
                        >
                            {/* Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                                <div>
                                    <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", margin: 0, fontFamily: "'Playfair Display', serif" }}>
                                        Importar {itemLabel}s
                                    </h2>
                                    <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
                                        Carga tu inventario masivamente
                                    </p>
                                </div>
                                <button onClick={resetImport} style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div style={{
                                display: "flex", gap: "4px", marginBottom: "20px",
                                background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "3px",
                            }}>
                                <button
                                    onClick={() => { setImportTab("csv"); setCsvStep(1); setCsvResult(null); }}
                                    style={{
                                        flex: 1, padding: "8px 16px", borderRadius: "8px",
                                        fontSize: "0.8rem", fontWeight: 600, border: "none", cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                        background: importTab === "csv" ? "rgba(122,158,138,0.1)" : "transparent",
                                        color: importTab === "csv" ? "#9ab8a8" : "var(--text-secondary)",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    <Table2 size={14} /> Archivo CSV / Excel
                                </button>
                                <button
                                    onClick={() => { setImportTab("scrape"); setScrapeStep(1); setScrapeResult(null); setScrapeError(""); }}
                                    style={{
                                        flex: 1, padding: "8px 16px", borderRadius: "8px",
                                        fontSize: "0.8rem", fontWeight: 600, border: "none", cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                        background: importTab === "scrape" ? "rgba(167,139,250,0.1)" : "transparent",
                                        color: importTab === "scrape" ? "#a78bfa" : "var(--text-secondary)",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    <Globe size={14} /> Desde página web
                                </button>
                            </div>

                            {/* ═══ CSV/Excel Tab ═══ */}
                            {importTab === "csv" && (
                                <div>
                                    {/* Step 1: Upload */}
                                    {csvStep === 1 && (
                                        <div>
                                            {/* Guide box */}
                                            <div className="glass-panel" style={{
                                                padding: "14px 16px", borderRadius: "12px",
                                                marginBottom: "16px",
                                            }}>
                                                <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "#9ab8a8", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                                                    <Sparkles size={13} /> ¿Cómo organizar tu archivo?
                                                </p>
                                                <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                                                    <p style={{ margin: "0 0 4px" }}>• Cada <strong style={{ color: "var(--text-primary)" }}>fila</strong> = un {itemLabel.toLowerCase()}</p>
                                                    <p style={{ margin: "0 0 4px" }}>• Cada <strong style={{ color: "var(--text-primary)" }}>columna</strong> = un dato (Nombre, Precio, Habitaciones, etc.)</p>
                                                    <p style={{ margin: "0 0 4px" }}>• La primera fila debe tener los <strong style={{ color: "var(--text-primary)" }}>nombres de las columnas</strong></p>
                                                    <p style={{ margin: "0 0 4px" }}>• El precio puede ser en <strong style={{ color: "#9ab8a8" }}>CLP</strong> o <strong style={{ color: "#a78bfa" }}>UF</strong> (agrega una columna &quot;Moneda&quot;)</p>
                                                </div>
                                                <button onClick={handleDownloadTemplate}
                                                    style={{
                                                        marginTop: "10px", padding: "6px 14px", borderRadius: "8px",
                                                        fontSize: "0.74rem", fontWeight: 600, cursor: "pointer",
                                                        background: "rgba(122,158,138,0.08)", border: "0.5px solid rgba(122,158,138,0.15)",
                                                        color: "#9ab8a8", display: "flex", alignItems: "center", gap: "6px",
                                                    }}>
                                                    <Download size={13} /> Descargar plantilla de ejemplo (.csv)
                                                </button>
                                            </div>

                                            <input
                                                ref={importFileRef}
                                                type="file"
                                                accept=".csv,.xlsx,.xls"
                                                style={{ display: "none" }}
                                                onChange={e => {
                                                    const f = e.target.files?.[0];
                                                    if (f) handleCsvUpload(f);
                                                }}
                                            />
                                            <div
                                                onClick={() => importFileRef.current?.click()}
                                                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#9ab8a8"; }}
                                                onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                                                onDrop={e => {
                                                    e.preventDefault();
                                                    e.currentTarget.style.borderColor = "var(--border)";
                                                    const f = e.dataTransfer.files[0];
                                                    if (f) handleCsvUpload(f);
                                                }}
                                                style={{
                                                    padding: "40px 20px",
                                                    borderRadius: "14px",
                                                    border: "2px dashed var(--border)",
                                                    background: "rgba(255,255,255,0.01)",
                                                    textAlign: "center",
                                                    cursor: "pointer",
                                                    transition: "all 0.2s ease",
                                                }}
                                            >
                                                {csvParsing ? (
                                                    <Loader2 size={32} className="animate-spin" style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
                                                ) : (
                                                    <Upload size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
                                                )}
                                                <p style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                                                    {csvParsing ? "Analizando archivo..." : "Arrastra tu archivo aquí o haz clic"}
                                                </p>
                                                <p style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                                    Formatos soportados: .csv, .xlsx, .xls
                                                </p>
                                            </div>
                                            {formError && (
                                                <div style={{
                                                    marginTop: "12px", padding: "10px 14px", borderRadius: "10px",
                                                    background: "rgba(239,68,68,0.05)", border: "0.5px solid rgba(239,68,68,0.12)",
                                                    color: "#f87171", fontSize: "0.8rem",
                                                    display: "flex", alignItems: "center", gap: "8px",
                                                }}>
                                                    <AlertCircle size={14} /> {formError}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Step 2: Column Mapping */}
                                    {csvStep === 2 && (
                                        <div>
                                            <div style={{
                                                padding: "10px 14px", borderRadius: "10px",
                                                background: "rgba(122,158,138,0.04)", border: "0.5px solid rgba(122,158,138,0.1)",
                                                marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px",
                                            }}>
                                                <Sparkles size={14} style={{ color: "#9ab8a8" }} />
                                                <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", margin: 0 }}>
                                                    <strong>{csvTotal}</strong> filas encontradas en <strong>{csvFile?.name}</strong>. Mapea cada columna al campo correspondiente.
                                                </p>
                                            </div>

                                            {/* Mapping table */}
                                            <div style={{ marginBottom: "16px" }}>
                                                {csvHeaders.map(h => (
                                                    <div key={h} style={{
                                                        display: "flex", alignItems: "center", gap: "12px",
                                                        padding: "8px 0", borderBottom: "0.5px solid rgba(255,255,255,0.04)",
                                                    }}>
                                                        <span style={{
                                                            flex: 1, fontSize: "0.82rem", fontWeight: 600,
                                                            color: "var(--text-primary)",
                                                        }}>
                                                            {h}
                                                        </span>
                                                        <ArrowRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                                                        <select
                                                            className="select"
                                                            value={csvMapping[h] || "ignore"}
                                                            onChange={e => setCsvMapping(prev => ({ ...prev, [h]: e.target.value }))}
                                                            style={{ width: "180px", fontSize: "0.8rem" }}
                                                        >
                                                            {getMappingOptions().map(opt => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Preview first 3 rows */}
                                            {csvPreview.length > 0 && (
                                                <div style={{ marginBottom: "16px" }}>
                                                    <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>
                                                        Vista previa (primeras 3 filas)
                                                    </p>
                                                    <div style={{ overflowX: "auto" }}>
                                                        <table style={{ width: "100%", fontSize: "0.74rem", borderCollapse: "collapse" }}>
                                                            <thead>
                                                                <tr>
                                                                    {csvHeaders.filter(h => csvMapping[h] !== "ignore").map(h => (
                                                                        <th key={h} style={{
                                                                            padding: "6px 8px", textAlign: "left",
                                                                            color: "#9ab8a8", fontWeight: 600,
                                                                            borderBottom: "0.5px solid var(--border)",
                                                                        }}>
                                                                            {getMappingOptions().find(o => o.value === csvMapping[h])?.label || h}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {csvPreview.slice(0, 3).map((row, i) => (
                                                                    <tr key={i}>
                                                                        {csvHeaders.filter(h => csvMapping[h] !== "ignore").map(h => (
                                                                            <td key={h} style={{
                                                                                padding: "6px 8px", color: "var(--text-secondary)",
                                                                                borderBottom: "0.5px solid rgba(255,255,255,0.03)",
                                                                                maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                                            }}>
                                                                                {row[h] || "—"}
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {formError && (
                                                <div style={{
                                                    marginBottom: "12px", padding: "10px 14px", borderRadius: "10px",
                                                    background: "rgba(239,68,68,0.05)", border: "0.5px solid rgba(239,68,68,0.12)",
                                                    color: "#f87171", fontSize: "0.8rem",
                                                }}>
                                                    {formError}
                                                </div>
                                            )}

                                            <div style={{ display: "flex", gap: "10px" }}>
                                                <button onClick={() => { setCsvStep(1); setCsvFile(null); setFormError(""); }}
                                                    className="btn-secondary flex items-center gap-2" style={{ fontSize: "0.82rem" }}>
                                                    <ArrowLeft size={14} /> Atrás
                                                </button>
                                                <button
                                                    onClick={handleCsvImport}
                                                    disabled={csvImporting}
                                                    className="btn-primary flex items-center gap-2"
                                                    style={{
                                                        flex: 1, justifyContent: "center", fontSize: "0.82rem",
                                                        opacity: csvImporting ? 0.5 : 1,
                                                        background: "linear-gradient(135deg, #22c55e, #16a34a)",
                                                    }}
                                                >
                                                    {csvImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                                    {csvImporting ? "Importando..." : `Importar ${csvTotal} ${itemLabel.toLowerCase()}s`}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 3: Result */}
                                    {csvStep === 3 && csvResult && (
                                        <div style={{ textAlign: "center", padding: "20px 0" }}>
                                            <div style={{
                                                width: "56px", height: "56px", borderRadius: "50%",
                                                background: csvResult.imported > 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                margin: "0 auto 16px",
                                            }}>
                                                {csvResult.imported > 0
                                                    ? <CheckCircle size={28} style={{ color: "#22c55e" }} />
                                                    : <AlertCircle size={28} style={{ color: "#ef4444" }} />}
                                            </div>
                                            <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                                                {csvResult.imported > 0 ? "¡Importación completada!" : "Error en la importación"}
                                            </p>
                                            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
                                                {csvResult.imported} importados · {csvResult.failed} fallidos
                                            </p>
                                            {csvResult.errors.length > 0 && (
                                                <div style={{
                                                    textAlign: "left", padding: "10px 14px", borderRadius: "10px",
                                                    background: "rgba(239,68,68,0.04)", border: "0.5px solid rgba(239,68,68,0.1)",
                                                    marginBottom: "16px", maxHeight: "120px", overflowY: "auto",
                                                }}>
                                                    {csvResult.errors.map((e, i) => (
                                                        <p key={i} style={{ fontSize: "0.72rem", color: "#f87171", margin: "2px 0" }}>{e}</p>
                                                    ))}
                                                </div>
                                            )}
                                            <button onClick={resetImport} className="btn-primary" style={{ fontSize: "0.84rem" }}>
                                                Cerrar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ═══ Scrape Tab ═══ */}
                            {importTab === "scrape" && (
                                <div>
                                    {/* Step 1: URL */}
                                    {scrapeStep === 1 && (
                                        <div>
                                            <div style={{
                                                padding: "12px 14px", borderRadius: "10px",
                                                background: "rgba(167,139,250,0.04)", border: "0.5px solid rgba(167,139,250,0.1)",
                                                marginBottom: "16px", display: "flex", alignItems: "flex-start", gap: "8px",
                                            }}>
                                                <Sparkles size={14} style={{ color: "#a78bfa", marginTop: "1px", flexShrink: 0 }} />
                                                <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                                                    Pega la URL de tu sitio web y nuestra IA analizará la página para extraer automáticamente
                                                    todos tus {itemLabel.toLowerCase()}s automaticamente.
                                                </p>
                                            </div>

                                            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                                                <input
                                                    className="input"
                                                    placeholder={`https://tusitio.com/${itemLabel.toLowerCase()}s`}
                                                    value={scrapeUrl}
                                                    onChange={e => setScrapeUrl(e.target.value)}
                                                    style={{ flex: 1, fontSize: "0.84rem" }}
                                                    onKeyDown={e => e.key === "Enter" && handleScrape()}
                                                />
                                                <button
                                                    onClick={handleScrape}
                                                    disabled={scrapeLoading || !scrapeUrl.trim()}
                                                    className="btn-primary flex items-center gap-2"
                                                    style={{
                                                        fontSize: "0.82rem", whiteSpace: "nowrap",
                                                        opacity: scrapeLoading || !scrapeUrl.trim() ? 0.5 : 1,
                                                        background: "linear-gradient(135deg, #a78bfa, #5d8270)",
                                                    }}
                                                >
                                                    {scrapeLoading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                                                    {scrapeLoading ? "Analizando..." : "Analizar"}
                                                </button>
                                            </div>

                                            {scrapeError && (
                                                <div style={{
                                                    padding: "10px 14px", borderRadius: "10px",
                                                    background: "rgba(239,68,68,0.05)", border: "0.5px solid rgba(239,68,68,0.12)",
                                                    color: "#f87171", fontSize: "0.8rem",
                                                    display: "flex", alignItems: "center", gap: "8px",
                                                }}>
                                                    <AlertCircle size={14} /> {scrapeError}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Step 2: Preview extracted products */}
                                    {scrapeStep === 2 && (
                                        <div>
                                            <div style={{
                                                padding: "10px 14px", borderRadius: "10px",
                                                background: "rgba(34,197,94,0.04)", border: "0.5px solid rgba(34,197,94,0.1)",
                                                marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px",
                                            }}>
                                                <CheckCircle size={14} style={{ color: "#22c55e" }} />
                                                <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", margin: 0 }}>
                                                    La IA encontró <strong style={{ color: "#22c55e" }}>{scrapeProducts.length}</strong> productos. Revisa y selecciona los que quieres importar.
                                                </p>
                                            </div>

                                            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px", maxHeight: "360px", overflowY: "auto" }}>
                                                {scrapeProducts.map((p, i) => (
                                                    <div key={i} style={{
                                                        padding: "12px 14px", borderRadius: "10px",
                                                        background: p.selected ? "var(--bg-card)" : "rgba(255,255,255,0.01)",
                                                        border: `0.5px solid ${p.selected ? "rgba(34,197,94,0.15)" : "var(--border)"}`,
                                                        opacity: p.selected ? 1 : 0.5,
                                                        cursor: "pointer",
                                                        transition: "all 0.2s ease",
                                                    }}
                                                        onClick={() => {
                                                            const next = [...scrapeProducts];
                                                            next[i] = { ...next[i], selected: !next[i].selected };
                                                            setScrapeProducts(next);
                                                        }}
                                                    >
                                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                            <div style={{
                                                                width: "20px", height: "20px", borderRadius: "4px",
                                                                border: `2px solid ${p.selected ? "#22c55e" : "var(--border)"}`,
                                                                background: p.selected ? "rgba(34,197,94,0.1)" : "transparent",
                                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                                flexShrink: 0,
                                                            }}>
                                                                {p.selected && <CheckCircle size={12} style={{ color: "#22c55e" }} />}
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
                                                                    {p.name}
                                                                </div>
                                                                {p.description && (
                                                                    <p style={{
                                                                        fontSize: "0.74rem", color: "var(--text-secondary)", margin: 0,
                                                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                                    }}>
                                                                        {p.description}
                                                                    </p>
                                                                )}
                                                                {Object.keys(p.attributes).length > 0 && (
                                                                    <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                                                                        {Object.entries(p.attributes).slice(0, 4).map(([k, v]) => (
                                                                            <span key={k} style={{
                                                                                padding: "1px 6px", borderRadius: "4px",
                                                                                fontSize: "0.65rem", fontWeight: 600,
                                                                                background: "rgba(255,255,255,0.04)",
                                                                                border: "0.5px solid rgba(255,255,255,0.06)",
                                                                                color: "var(--text-muted)",
                                                                            }}>
                                                                                {k}: {v}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div style={{ display: "flex", gap: "10px" }}>
                                                <button onClick={() => { setScrapeStep(1); setScrapeProducts([]); }}
                                                    className="btn-secondary flex items-center gap-2" style={{ fontSize: "0.82rem" }}>
                                                    <ArrowLeft size={14} /> Atrás
                                                </button>
                                                <button
                                                    onClick={handleScrapeImport}
                                                    disabled={scrapeImporting || scrapeProducts.filter(p => p.selected).length === 0}
                                                    className="btn-primary flex items-center gap-2"
                                                    style={{
                                                        flex: 1, justifyContent: "center", fontSize: "0.82rem",
                                                        opacity: scrapeImporting || scrapeProducts.filter(p => p.selected).length === 0 ? 0.5 : 1,
                                                        background: "linear-gradient(135deg, #22c55e, #16a34a)",
                                                    }}
                                                >
                                                    {scrapeImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                                    {scrapeImporting ? "Importando..." : `Importar ${scrapeProducts.filter(p => p.selected).length} ${itemLabel.toLowerCase()}s`}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 3: Result */}
                                    {scrapeStep === 3 && scrapeResult && (
                                        <div style={{ textAlign: "center", padding: "20px 0" }}>
                                            <div style={{
                                                width: "56px", height: "56px", borderRadius: "50%",
                                                background: scrapeResult.imported > 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                margin: "0 auto 16px",
                                            }}>
                                                {scrapeResult.imported > 0
                                                    ? <CheckCircle size={28} style={{ color: "#22c55e" }} />
                                                    : <AlertCircle size={28} style={{ color: "#ef4444" }} />}
                                            </div>
                                            <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                                                {scrapeResult.imported > 0 ? "¡Importación completada!" : "Error en la importación"}
                                            </p>
                                            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
                                                {scrapeResult.imported} importados · {scrapeResult.failed} fallidos
                                            </p>
                                            {scrapeResult.errors.length > 0 && (
                                                <div style={{
                                                    textAlign: "left", padding: "10px 14px", borderRadius: "10px",
                                                    background: "rgba(239,68,68,0.04)", border: "0.5px solid rgba(239,68,68,0.1)",
                                                    marginBottom: "16px", maxHeight: "120px", overflowY: "auto",
                                                }}>
                                                    {scrapeResult.errors.map((e, i) => (
                                                        <p key={i} style={{ fontSize: "0.72rem", color: "#f87171", margin: "2px 0" }}>{e}</p>
                                                    ))}
                                                </div>
                                            )}
                                            <button onClick={resetImport} className="btn-primary" style={{ fontSize: "0.84rem" }}>
                                                Cerrar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
