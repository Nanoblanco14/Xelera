"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    X, Search, User, Loader2, XCircle, CalendarCheck, CheckCircle,
} from "lucide-react";
import { Lead, Product, TimeSlot } from "./types";

/* ═══════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════ */
interface AppointmentModalProps {
    show: boolean;
    onClose: () => void;
    /* Lead search */
    leadSearch: string;
    onLeadSearchChange: (value: string) => void;
    filteredLeads: Lead[];
    leadsLoading: boolean;
    selectedLead: Lead | null;
    onSelectLead: (lead: Lead) => void;
    onClearLead: () => void;
    /* Product */
    products: Product[];
    selectedProduct: string;
    onProductChange: (value: string) => void;
    /* Date & slots */
    appointmentDate: string;
    onDateChange: (value: string) => void;
    availableSlots: TimeSlot[];
    slotsLoading: boolean;
    selectedSlot: TimeSlot | null;
    onSlotSelect: (slot: TimeSlot) => void;
    /* Notes */
    appointmentNotes: string;
    onNotesChange: (value: string) => void;
    /* Submit */
    creating: boolean;
    createSuccess: boolean;
    createError: string;
    onSubmit: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
export default function AppointmentModal({
    show,
    onClose,
    leadSearch,
    onLeadSearchChange,
    filteredLeads,
    leadsLoading,
    selectedLead,
    onSelectLead,
    onClearLead,
    products,
    selectedProduct,
    onProductChange,
    appointmentDate,
    onDateChange,
    availableSlots,
    slotsLoading,
    selectedSlot,
    onSlotSelect,
    appointmentNotes,
    onNotesChange,
    creating,
    createSuccess,
    createError,
    onSubmit,
}: AppointmentModalProps) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.6)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: 20,
                    }}
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", damping: 25 }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                            borderRadius: 16,
                            padding: 28,
                            width: "100%",
                            maxWidth: 520,
                            maxHeight: "90vh",
                            overflowY: "auto",
                        }}
                    >
                        {/* Success state */}
                        {createSuccess ? (
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                style={{ textAlign: "center", padding: "40px 20px" }}
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", damping: 10, delay: 0.1 }}
                                >
                                    <CheckCircle size={56} style={{ color: "#10b981", marginBottom: 16 }} />
                                </motion.div>
                                <h3 style={{ color: "var(--text-primary)", margin: "0 0 4px", fontSize: 18 }}>
                                    Cita agendada
                                </h3>
                                <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>
                                    La cita fue creada exitosamente
                                </p>
                            </motion.div>
                        ) : (
                            <>
                                {/* Modal header */}
                                <div style={{
                                    display: "flex", justifyContent: "space-between",
                                    alignItems: "center", marginBottom: 24,
                                }}>
                                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
                                        Nueva Cita
                                    </h2>
                                    <button
                                        onClick={onClose}
                                        style={{
                                            background: "none", border: "none", cursor: "pointer",
                                            color: "var(--text-muted)", padding: 4,
                                        }}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Lead search */}
                                <div style={{ marginBottom: 18 }}>
                                    <label style={{
                                        display: "block", fontSize: 13, fontWeight: 500,
                                        color: "var(--text-secondary)", marginBottom: 6,
                                    }}>
                                        Cliente *
                                    </label>
                                    {selectedLead ? (
                                        <div style={{
                                            display: "flex", alignItems: "center", gap: 10,
                                            padding: "10px 14px",
                                            borderRadius: 10,
                                            border: "1px solid var(--border)",
                                            background: "rgba(59,130,246,0.06)",
                                        }}>
                                            <User size={16} style={{ color: "#3b82f6" }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                                                    {selectedLead.name}
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                    {selectedLead.phone}
                                                </div>
                                            </div>
                                            <button
                                                onClick={onClearLead}
                                                style={{
                                                    background: "none", border: "none", cursor: "pointer",
                                                    color: "var(--text-muted)", padding: 2,
                                                }}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ position: "relative" }}>
                                            <div style={{ position: "relative" }}>
                                                <Search size={16} style={{
                                                    position: "absolute", left: 12, top: "50%",
                                                    transform: "translateY(-50%)", color: "var(--text-muted)",
                                                }} />
                                                <input
                                                    className="input"
                                                    placeholder={leadsLoading ? "Cargando clientes..." : "Buscar cliente por nombre o teléfono..."}
                                                    value={leadSearch}
                                                    onChange={(e) => onLeadSearchChange(e.target.value)}
                                                    style={{
                                                        width: "100%",
                                                        paddingLeft: 36,
                                                        boxSizing: "border-box",
                                                    }}
                                                />
                                            </div>
                                            {leadSearch && filteredLeads.length > 0 && (
                                                <div style={{
                                                    position: "absolute",
                                                    top: "100%",
                                                    left: 0,
                                                    right: 0,
                                                    marginTop: 4,
                                                    background: "var(--bg-card)",
                                                    border: "1px solid var(--border)",
                                                    borderRadius: 10,
                                                    maxHeight: 200,
                                                    overflowY: "auto",
                                                    zIndex: 10,
                                                }}>
                                                    {filteredLeads.map((l) => (
                                                        <div
                                                            key={l.id}
                                                            onClick={() => onSelectLead(l)}
                                                            style={{
                                                                padding: "10px 14px",
                                                                cursor: "pointer",
                                                                borderBottom: "1px solid var(--border)",
                                                                transition: "background 0.15s",
                                                            }}
                                                            onMouseEnter={(e) =>
                                                                (e.currentTarget.style.background = "rgba(59,130,246,0.06)")
                                                            }
                                                            onMouseLeave={(e) =>
                                                                (e.currentTarget.style.background = "transparent")
                                                            }
                                                        >
                                                            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                                                                {l.name}
                                                            </div>
                                                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                                                {l.phone}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {leadSearch && filteredLeads.length === 0 && !leadsLoading && (
                                                <div style={{
                                                    position: "absolute",
                                                    top: "100%",
                                                    left: 0,
                                                    right: 0,
                                                    marginTop: 4,
                                                    background: "var(--bg-card)",
                                                    border: "1px solid var(--border)",
                                                    borderRadius: 10,
                                                    padding: "12px 14px",
                                                    fontSize: 13,
                                                    color: "var(--text-muted)",
                                                    textAlign: "center",
                                                    zIndex: 10,
                                                }}>
                                                    No se encontraron clientes
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Service select */}
                                <div style={{ marginBottom: 18 }}>
                                    <label style={{
                                        display: "block", fontSize: 13, fontWeight: 500,
                                        color: "var(--text-secondary)", marginBottom: 6,
                                    }}>
                                        Servicio
                                    </label>
                                    <select
                                        className="select"
                                        value={selectedProduct}
                                        onChange={(e) => onProductChange(e.target.value)}
                                        style={{ width: "100%", boxSizing: "border-box" }}
                                    >
                                        <option value="">Sin servicio asociado</option>
                                        {products.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Date */}
                                <div style={{ marginBottom: 18 }}>
                                    <label style={{
                                        display: "block", fontSize: 13, fontWeight: 500,
                                        color: "var(--text-secondary)", marginBottom: 6,
                                    }}>
                                        Fecha *
                                    </label>
                                    <input
                                        className="input"
                                        type="date"
                                        value={appointmentDate}
                                        onChange={(e) => onDateChange(e.target.value)}
                                        style={{ width: "100%", boxSizing: "border-box" }}
                                    />
                                </div>

                                {/* Time slots */}
                                {appointmentDate && (
                                    <div style={{ marginBottom: 18 }}>
                                        <label style={{
                                            display: "block", fontSize: 13, fontWeight: 500,
                                            color: "var(--text-secondary)", marginBottom: 8,
                                        }}>
                                            Horario disponible *
                                        </label>
                                        {slotsLoading ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}>
                                                <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
                                                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                                    Consultando disponibilidad...
                                                </span>
                                            </div>
                                        ) : availableSlots.length > 0 ? (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                {availableSlots.map((slot, i) => {
                                                    const isSelected = selectedSlot?.start === slot.start;
                                                    return (
                                                        <motion.button
                                                            key={i}
                                                            onClick={() => onSlotSelect(slot)}
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.97 }}
                                                            style={{
                                                                padding: "8px 14px",
                                                                borderRadius: 8,
                                                                border: isSelected
                                                                    ? "2px solid #3b82f6"
                                                                    : "1px solid var(--border)",
                                                                background: isSelected
                                                                    ? "rgba(59,130,246,0.12)"
                                                                    : "transparent",
                                                                color: isSelected
                                                                    ? "#3b82f6"
                                                                    : "var(--text-primary)",
                                                                fontSize: 13,
                                                                fontWeight: isSelected ? 600 : 500,
                                                                cursor: "pointer",
                                                                fontVariantNumeric: "tabular-nums",
                                                                transition: "all 0.15s",
                                                            }}
                                                        >
                                                            {slot.start.slice(11, 16)}
                                                        </motion.button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div style={{
                                                padding: "16px",
                                                textAlign: "center",
                                                fontSize: 13,
                                                color: "var(--text-muted)",
                                                borderRadius: 8,
                                                border: "1px dashed var(--border)",
                                            }}>
                                                No hay horarios disponibles para esta fecha
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Notes */}
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{
                                        display: "block", fontSize: 13, fontWeight: 500,
                                        color: "var(--text-secondary)", marginBottom: 6,
                                    }}>
                                        Notas (opcional)
                                    </label>
                                    <textarea
                                        className="input"
                                        value={appointmentNotes}
                                        onChange={(e) => onNotesChange(e.target.value)}
                                        placeholder="Agregar notas o instrucciones especiales..."
                                        rows={3}
                                        style={{
                                            width: "100%",
                                            resize: "vertical",
                                            boxSizing: "border-box",
                                            fontFamily: "inherit",
                                        }}
                                    />
                                </div>

                                {/* Error */}
                                {createError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        style={{
                                            padding: "10px 14px",
                                            borderRadius: 8,
                                            background: "rgba(239,68,68,0.08)",
                                            border: "1px solid rgba(239,68,68,0.2)",
                                            color: "#ef4444",
                                            fontSize: 13,
                                            marginBottom: 16,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                        }}
                                    >
                                        <XCircle size={16} /> {createError}
                                    </motion.div>
                                )}

                                {/* Submit */}
                                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                                    <button
                                        className="btn-secondary"
                                        onClick={onClose}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        className="btn-primary"
                                        onClick={onSubmit}
                                        disabled={!selectedLead || !selectedSlot || !appointmentDate || creating}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 6,
                                            opacity: (!selectedLead || !selectedSlot || !appointmentDate || creating) ? 0.5 : 1,
                                        }}
                                    >
                                        {creating ? (
                                            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                                        ) : (
                                            <CalendarCheck size={16} />
                                        )}
                                        {creating ? "Agendando..." : "Confirmar Cita"}
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
