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
    const industryFields: IndustryField[] = template.industryFields;

    /* Modal state */
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState<CatalogItem | null>(null);
    const [viewItem, setViewItem] = useState<CatalogItem | null>(null);

    /* Form state */
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [quickFields, setQuickFields] = useState<Record<string, string>>({});
    const [attrs, setAttrs] = useState<AttrRow[]>([]);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [existingFiles, setExistingFiles] = useState<PFile[]>([]);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    /* ── Fetch items ────────────────────────────────── */
    const fetchItems = useCallback(async () => {
        if (!organization) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/products?organization_id=${organization.id}`);
            const data = await res.json();
            setItems(data.products || []);
        } catch { /* empty */ }
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
        setEditItem(null); setName(""); setDescription(""); setPrice("");
        initQuickFields();
        setAttrs([]); setPendingFiles([]); setExistingFiles([]);
        setFormError(""); setShowModal(true);
    };

    const openEdit = (p: CatalogItem) => {
        setEditItem(p); setName(p.name); setDescription(p.description);
        setPrice(p.attributes?.precio ?? "");
        initQuickFields(p.attributes ?? {});
        const reservedKeys = new Set([...industryFields.map(f => f.key), "precio"]);
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
        if (price.trim()) attributes["precio"] = price.trim();
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
            const { product } = await res.json();

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
        const headers = ["Nombre", "Descripcion", "Precio", "Estado", "Fecha"];
        const rows = filtered.map(p => [
            p.name,
            p.description,
            p.attributes?.precio || "",
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

    const toggleSort = (field: typeof sortBy) => {
        if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortBy(field); setSortDir("asc"); }
    };

    /* ── Render ─────────────────────────────────────── */
    const statusS = (s: string) => statusConfig[s] || statusConfig.active;

    return (
        <div className="animate-in">
            {/* ── Header ───────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Inventario</h1>
                    <p className="page-subtitle">
                        El bot usa este catálogo en cada conversación
                    </p>
                </div>
                <button onClick={openCreate} className="btn-primary">
                    <Plus size={18} /> Nuevo {itemLabel}
                </button>
            </div>

            {/* ── KPI Stats ────────────────────────── */}
            {items.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px", marginBottom: "24px" }}>
                    {[
                        { label: "Total", value: stats.total, icon: Package, color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
                        { label: "Activos", value: stats.active, icon: Eye, color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
                        { label: "Inactivos", value: stats.inactive, icon: EyeOff, color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
                        { label: "Archivados", value: stats.archived, icon: Archive, color: "#52525b", bg: "rgba(82,82,91,0.12)" },
                    ].map(kpi => (
                        <div key={kpi.label} style={{
                            background: "var(--bg-card)", border: "1px solid var(--border)",
                            borderRadius: "14px", padding: "16px 20px",
                            display: "flex", alignItems: "center", gap: "14px",
                        }}>
                            <div style={{
                                width: "36px", height: "36px", borderRadius: "10px",
                                background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                                <kpi.icon size={17} style={{ color: kpi.color }} />
                            </div>
                            <div>
                                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1 }}>{kpi.value}</div>
                                <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{kpi.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Toolbar ──────────────────────────── */}
            {items.length > 0 && (
                <div style={{
                    display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px",
                    marginBottom: "20px", padding: "14px 18px",
                    background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px",
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
                                    style={{
                                        padding: "4px 11px", borderRadius: "100px",
                                        fontSize: "0.68rem", fontWeight: 600,
                                        background: statusFilter === val ? "rgba(59,130,246,0.1)" : "transparent",
                                        border: statusFilter === val ? "1px solid rgba(59,130,246,0.25)" : "1px solid transparent",
                                        color: statusFilter === val ? "#60a5fa" : "var(--text-muted)",
                                        cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s ease",
                                    }}>
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
                    <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
                        <button onClick={() => setViewMode("grid")} style={{
                            padding: "6px 10px", background: viewMode === "grid" ? "rgba(59,130,246,0.1)" : "transparent",
                            border: "none", cursor: "pointer", display: "flex", alignItems: "center",
                            color: viewMode === "grid" ? "#60a5fa" : "var(--text-muted)",
                        }}><LayoutGrid size={15} /></button>
                        <button onClick={() => setViewMode("table")} style={{
                            padding: "6px 10px", background: viewMode === "table" ? "rgba(59,130,246,0.1)" : "transparent",
                            border: "none", borderLeft: "1px solid var(--border)", cursor: "pointer",
                            display: "flex", alignItems: "center",
                            color: viewMode === "table" ? "#60a5fa" : "var(--text-muted)",
                        }}><List size={15} /></button>
                    </div>

                    {/* CSV Export */}
                    <button onClick={handleExportCSV}
                        className="btn-secondary" style={{ padding: "6px 12px", fontSize: "0.7rem", gap: "4px" }}>
                        <Download size={13} /> CSV
                    </button>

                    {/* Bulk toggle */}
                    <button onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
                        className="btn-secondary" style={{
                            padding: "6px 12px", fontSize: "0.7rem", gap: "4px",
                            background: bulkMode ? "rgba(59,130,246,0.1)" : undefined,
                            borderColor: bulkMode ? "rgba(59,130,246,0.25)" : undefined,
                            color: bulkMode ? "#60a5fa" : undefined,
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
                        style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            padding: "10px 18px", marginBottom: "16px",
                            background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)",
                            borderRadius: "12px",
                        }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#60a5fa" }}>
                            {selectedIds.size} seleccionado{selectedIds.size > 1 ? "s" : ""}
                        </span>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => handleBulkStatusChange("active")}
                            style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 600, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", cursor: "pointer" }}>
                            <Eye size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} />Activar
                        </button>
                        <button onClick={() => handleBulkStatusChange("inactive")}
                            style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 600, background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)", cursor: "pointer" }}>
                            <EyeOff size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} />Desactivar
                        </button>
                        <button onClick={() => handleBulkStatusChange("archived")}
                            style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 600, background: "rgba(82,82,91,0.12)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
                            <Archive size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} />Archivar
                        </button>
                        <button onClick={handleBulkDelete}
                            style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 600, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>
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
                <div className="glass-card p-0 overflow-hidden">
                    <div className="flex flex-col items-center justify-center py-20 px-8">
                        <motion.div
                            animate={{ y: [0, -6, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            className="flex items-center justify-center w-20 h-20 rounded-3xl mb-6"
                            style={{ background: "rgba(59,130,246,0.08)", border: "1px dashed var(--border-active)" }}>
                            <Package size={36} style={{ color: "var(--accent-light)", opacity: 0.7 }} />
                        </motion.div>
                        <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                            Sin {itemLabel.toLowerCase()}s todavia
                        </h3>
                        <p className="text-sm mb-6 text-center max-w-sm" style={{ color: "var(--text-secondary)" }}>
                            Registra tu primer {itemLabel.toLowerCase()} para que el agente AI pueda responder consultas
                            con informacion precisa de tu catalogo.
                        </p>
                        <button onClick={openCreate} className="btn-primary">
                            <Plus size={18} /> Crear Primer {itemLabel}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Grid View ──────────────────────────── */}
            {!loading && filtered.length > 0 && viewMode === "grid" && (
                <div className="grid-products">
                    <AnimatePresence mode="popLayout">
                        {filtered.map((p) => {
                            const imgFile = p.product_files?.find(f => f.file_type === "image");
                            const hasEmbedding = !!p.embedding;
                            const st = statusS(p.status || "active");
                            return (
                                <motion.div key={p.id}
                                    layout
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    whileHover={{ y: -3 }}
                                    className="glass-card overflow-hidden cursor-pointer"
                                    style={{ position: "relative" }}
                                    onClick={() => setViewItem(p)}>

                                    {/* Bulk checkbox */}
                                    {bulkMode && (
                                        <div onClick={e => { e.stopPropagation(); toggleSelect(p.id); }}
                                            style={{ position: "absolute", top: "10px", left: "10px", zIndex: 3, cursor: "pointer" }}>
                                            {selectedIds.has(p.id) ?
                                                <CheckSquare size={20} style={{ color: "#3b82f6" }} /> :
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
                                        <h3 className="font-semibold text-sm mb-1 truncate" style={{ color: "var(--text-primary)" }}>{p.name}</h3>
                                        {p.attributes?.precio && (
                                            <p className="text-base font-bold mb-1" style={{ color: "var(--accent-light)" }}>
                                                ${Number(p.attributes.precio).toLocaleString("es-CL")}
                                            </p>
                                        )}
                                        <p className="text-xs line-clamp-2 mb-3" style={{ color: "var(--text-secondary)" }}>
                                            {p.description || "Sin descripcion"}
                                        </p>
                                        {Object.keys(p.attributes || {}).length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                {Object.entries(p.attributes).filter(([k]) => k !== "precio").slice(0, 3).map(([k, v]) => (
                                                    <span key={k} className="text-[0.65rem] px-2 py-0.5 rounded-full"
                                                        style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.07)" }}>
                                                        {k}: {v}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between pt-3"
                                            style={{ borderTop: "1px solid var(--border)" }}>
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
                            <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                {bulkMode && (
                                    <th className="table-header-cell" style={{ width: "40px", paddingLeft: "16px" }}>
                                        <button onClick={() => {
                                            if (selectedIds.size === filtered.length) setSelectedIds(new Set());
                                            else setSelectedIds(new Set(filtered.map(p => p.id)));
                                        }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                                            {selectedIds.size === filtered.length ?
                                                <CheckSquare size={16} style={{ color: "#3b82f6" }} /> :
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
                                                        <CheckSquare size={16} style={{ color: "#3b82f6" }} /> :
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
                                            <td className="table-cell" style={{ color: p.attributes?.precio ? "var(--accent-light)" : "var(--text-muted)" }}>
                                                {p.attributes?.precio ? `$${Number(p.attributes.precio).toLocaleString("es-CL")}` : "—"}
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
                                                <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                                                    <button onClick={e => { e.stopPropagation(); openEdit(p); }}
                                                        style={{
                                                            padding: "5px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.04)",
                                                            border: "1px solid var(--border)", cursor: "pointer", display: "flex", color: "var(--text-secondary)",
                                                        }}><Edit3 size={13} /></button>
                                                    <button onClick={e => { e.stopPropagation(); handleDelete(p.id); }}
                                                        style={{
                                                            padding: "5px 8px", borderRadius: "6px", background: "rgba(239,68,68,0.08)",
                                                            border: "1px solid rgba(239,68,68,0.15)", cursor: "pointer", display: "flex", color: "#ef4444",
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
                <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                    <Search size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                    <p style={{ fontSize: "0.88rem" }}>Sin resultados para esta busqueda o filtro</p>
                </div>
            )}

            {/* ── VIEW Modal ───────────────────────── */}
            {viewItem && (
                <div className="modal-overlay animate-in" onClick={() => setViewItem(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "560px" }}>
                        <div className="modal-header">
                            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{viewItem.name}</h2>
                            <button onClick={() => setViewItem(null)}
                                className="p-1 rounded-lg transition-colors hover:bg-white/5 cursor-pointer"
                                style={{ background: "none", border: "none", color: "var(--text-muted)" }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            {viewItem.description && (
                                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{viewItem.description}</p>
                            )}
                            {Object.keys(viewItem.attributes || {}).length > 0 && (
                                <div>
                                    <h4 className="form-label mb-2">Atributos</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(viewItem.attributes).map(([k, v]) => (
                                            <div key={k} className="flex items-center gap-2 p-2.5 rounded-lg"
                                                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                                                <span className="text-xs font-medium" style={{ color: "var(--accent-light)" }}>{k}</span>
                                                <span className="text-xs" style={{ color: "var(--text-primary)" }}>{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {viewItem.product_files && viewItem.product_files.length > 0 && (
                                <div>
                                    <h4 className="form-label mb-2">Archivos</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {viewItem.product_files.map(f => (
                                            <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer"
                                                className="flex items-center gap-2 p-3 rounded-lg transition-colors hover:bg-white/5"
                                                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", textDecoration: "none" }}>
                                                {f.file_type === "image" ?
                                                    <ImageIcon size={16} style={{ color: "var(--info)" }} /> :
                                                    <FileText size={16} style={{ color: "var(--warning)" }} />}
                                                <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>{f.file_name}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── CREATE / EDIT Modal ──────────────── */}
            {showModal && (
                <div className="modal-overlay animate-in" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "640px" }}>
                        <div className="modal-header mb-2">
                            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                                {editItem ? `Editar ${itemLabel}` : `Nuevo ${itemLabel}`}
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
                                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
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
                                <input className="input" placeholder="Ej: 150000" type="number" min="0"
                                    value={price} onChange={e => setPrice(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Descripcion</label>
                                <textarea className="textarea" placeholder={`Describe este ${itemLabel.toLowerCase()} en detalle...`}
                                    value={description} onChange={e => setDescription(e.target.value)}
                                    rows={3} style={{ minHeight: "80px" }} />
                            </div>
                            {industryFields.length > 0 && (
                                <div>
                                    <label className="form-label mb-3 block">Campos de {template.label}</label>
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
                                <div className="flex flex-col items-center justify-center p-6 rounded-xl transition-colors cursor-pointer"
                                    style={{ border: "2px dashed var(--border)", background: "var(--bg-card)" }}
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
                                                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
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
                                                style={{ background: "var(--bg-secondary)", border: "1px solid rgba(255,255,255,0.06)" }}>
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
                                {saving ? <><Loader2 size={15} className="animate-spin" /> Guardando...</> : <>{editItem ? "Actualizar" : `Crear ${itemLabel}`}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
