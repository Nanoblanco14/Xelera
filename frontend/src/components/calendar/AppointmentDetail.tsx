"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    Calendar, Plus, Clock, User, Phone, X,
    Check, XCircle, AlertTriangle,
} from "lucide-react";
import {
    Appointment, DAY_NAMES_FULL, MONTH_NAMES,
    getMondayDow, fmtTime, glassCard,
} from "./types";
import { STATUS_CONFIG } from "./status-config";

/* ═══════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════ */
interface AppointmentDetailProps {
    selectedDay: Date | null;
    appointments: Appointment[];
    updatingId: string | null;
    onNewAppointment: (date: Date) => void;
    onClose: () => void;
    onUpdateStatus: (id: string, status: string, reason?: string) => void;
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
export default function AppointmentDetail({
    selectedDay,
    appointments,
    updatingId,
    onNewAppointment,
    onClose,
    onUpdateStatus,
}: AppointmentDetailProps) {
    return (
        <AnimatePresence>
            {selectedDay && (
                <motion.div
                    initial={{ opacity: 0, y: 20, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: 20, height: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ marginTop: 20, overflow: "hidden" }}
                >
                    <div style={glassCard}>
                        <div style={{
                            display: "flex", justifyContent: "space-between",
                            alignItems: "center", marginBottom: 16,
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                                    {DAY_NAMES_FULL[getMondayDow(selectedDay)]},{" "}
                                    {selectedDay.getDate()} de {MONTH_NAMES[selectedDay.getMonth()]}
                                </h3>
                                <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                                    {appointments.length} cita{appointments.length !== 1 ? "s" : ""}
                                </p>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    className="btn-primary"
                                    onClick={() => onNewAppointment(selectedDay)}
                                    style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, padding: "6px 14px" }}
                                >
                                    <Plus size={14} /> Agendar
                                </button>
                                <button
                                    className="btn-secondary"
                                    onClick={onClose}
                                    style={{ padding: "6px 10px", display: "flex", alignItems: "center" }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {appointments.length === 0 ? (
                            <div style={{
                                textAlign: "center",
                                padding: "40px 20px",
                                color: "var(--text-muted)",
                            }}>
                                <Calendar size={36} style={{ marginBottom: 8, opacity: 0.4 }} />
                                <p style={{ fontSize: 14, margin: 0 }}>No hay citas para este día</p>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {appointments.map((apt) => {
                                    const sc = STATUS_CONFIG[apt.status] || STATUS_CONFIG.confirmed;
                                    const isUpdating = updatingId === apt.id;

                                    return (
                                        <motion.div
                                            key={apt.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 14,
                                                padding: "14px 16px",
                                                borderRadius: 12,
                                                border: "0.5px solid var(--border)",
                                                background: "rgba(255,255,255,0.02)",
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            {/* Time */}
                                            <div style={{
                                                display: "flex", alignItems: "center", gap: 6,
                                                minWidth: 110, flexShrink: 0,
                                            }}>
                                                <Clock size={14} style={{ color: "var(--text-muted)" }} />
                                                <span style={{
                                                    fontSize: 14, fontWeight: 600,
                                                    color: "var(--text-primary)",
                                                    fontVariantNumeric: "tabular-nums",
                                                }}>
                                                    {fmtTime(apt.start_time)} - {fmtTime(apt.end_time)}
                                                </span>
                                            </div>

                                            {/* Client info */}
                                            <div style={{ flex: 1, minWidth: 160 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <User size={13} style={{ color: "var(--text-muted)" }} />
                                                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                                                        {apt.lead_name || "Sin nombre"}
                                                    </span>
                                                </div>
                                                {apt.lead_phone && (
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                                                        <Phone size={11} style={{ color: "var(--text-muted)" }} />
                                                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                                            {apt.lead_phone}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Service */}
                                            {apt.product_name && (
                                                <div style={{
                                                    fontSize: 12, color: "var(--text-secondary)",
                                                    background: "rgba(255,255,255,0.04)",
                                                    padding: "4px 10px",
                                                    borderRadius: 6,
                                                    border: "0.5px solid var(--border)",
                                                }}>
                                                    {apt.product_name}
                                                </div>
                                            )}

                                            {/* Status badge */}
                                            <div style={{
                                                display: "flex", alignItems: "center", gap: 5,
                                                fontSize: 12, fontWeight: 600,
                                                color: sc.color,
                                                background: sc.bg,
                                                padding: "4px 10px",
                                                borderRadius: 6,
                                            }}>
                                                {sc.icon}
                                                {sc.label}
                                            </div>

                                            {/* Actions */}
                                            {apt.status === "confirmed" && (
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button
                                                        onClick={() => onUpdateStatus(apt.id, "completed")}
                                                        disabled={isUpdating}
                                                        style={{
                                                            fontSize: 11, fontWeight: 600,
                                                            padding: "5px 10px", borderRadius: 6,
                                                            border: "0.5px solid rgba(16,185,129,0.3)",
                                                            background: "rgba(16,185,129,0.08)",
                                                            color: "#10b981",
                                                            cursor: "pointer",
                                                            display: "flex", alignItems: "center", gap: 4,
                                                            opacity: isUpdating ? 0.5 : 1,
                                                        }}
                                                    >
                                                        <Check size={12} /> Completada
                                                    </button>
                                                    <button
                                                        onClick={() => onUpdateStatus(apt.id, "no_show")}
                                                        disabled={isUpdating}
                                                        style={{
                                                            fontSize: 11, fontWeight: 600,
                                                            padding: "5px 10px", borderRadius: 6,
                                                            border: "0.5px solid rgba(245,158,11,0.3)",
                                                            background: "rgba(245,158,11,0.08)",
                                                            color: "#f59e0b",
                                                            cursor: "pointer",
                                                            display: "flex", alignItems: "center", gap: 4,
                                                            opacity: isUpdating ? 0.5 : 1,
                                                        }}
                                                    >
                                                        <AlertTriangle size={12} /> No asistió
                                                    </button>
                                                    <button
                                                        onClick={() => onUpdateStatus(apt.id, "cancelled", "Cancelada manualmente")}
                                                        disabled={isUpdating}
                                                        style={{
                                                            fontSize: 11, fontWeight: 600,
                                                            padding: "5px 10px", borderRadius: 6,
                                                            border: "0.5px solid rgba(239,68,68,0.3)",
                                                            background: "rgba(239,68,68,0.08)",
                                                            color: "#ef4444",
                                                            cursor: "pointer",
                                                            display: "flex", alignItems: "center", gap: 4,
                                                            opacity: isUpdating ? 0.5 : 1,
                                                        }}
                                                    >
                                                        <XCircle size={12} /> Cancelar
                                                    </button>
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
