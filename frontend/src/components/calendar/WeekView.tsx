"use client";

import { motion } from "framer-motion";
import { Appointment, DAY_NAMES, HOURS, toDateKey, isSameDay, isoToHour } from "./types";
import { STATUS_CONFIG } from "./status-config";

/* ═══════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════ */
interface WeekViewProps {
    weekDays: Date[];
    appointmentsByDay: Record<string, Appointment[]>;
    today: Date;
    onSelectDay: (date: Date) => void;
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
export default function WeekView({
    weekDays,
    appointmentsByDay,
    today,
    onSelectDay,
}: WeekViewProps) {
    return (
        <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 700 }}>
                {/* Week column headers */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "60px repeat(7, 1fr)",
                    gap: 1,
                    marginBottom: 2,
                }}>
                    <div /> {/* Time gutter */}
                    {weekDays.map((d, i) => {
                        const isToday = isSameDay(d, today);
                        return (
                            <div key={i} style={{
                                textAlign: "center",
                                padding: "8px 4px",
                                borderRadius: 8,
                                background: isToday ? "rgba(122,158,138,0.08)" : "transparent",
                            }}>
                                <div style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "var(--text-muted)",
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                }}>
                                    {DAY_NAMES[i]}
                                </div>
                                <div style={{
                                    fontSize: 18,
                                    fontWeight: isToday ? 700 : 500,
                                    color: isToday ? "var(--accent)" : "var(--text-primary)",
                                    marginTop: 2,
                                }}>
                                    {d.getDate()}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Hour rows */}
                <div style={{ position: "relative" }}>
                    {HOURS.map((hour) => (
                        <div
                            key={hour}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "60px repeat(7, 1fr)",
                                gap: 1,
                                minHeight: 56,
                                borderTop: "0.5px solid var(--border)",
                            }}
                        >
                            <div style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                padding: "4px 8px 0 0",
                                textAlign: "right",
                                fontWeight: 500,
                            }}>
                                {String(hour).padStart(2, "0")}:00
                            </div>
                            {weekDays.map((day, di) => {
                                const key = toDateKey(day);
                                const dayAppts = appointmentsByDay[key] || [];
                                const hourAppts = dayAppts.filter((apt) => {
                                    const h = isoToHour(apt.start_time);
                                    return h === hour;
                                });

                                return (
                                    <div
                                        key={di}
                                        style={{
                                            position: "relative",
                                            borderLeft: "0.5px solid var(--border)",
                                            minHeight: 56,
                                        }}
                                    >
                                        {hourAppts.map((apt) => {
                                            const sc = STATUS_CONFIG[apt.status] || STATUS_CONFIG.confirmed;
                                            const startMin = parseInt(apt.start_time.slice(14, 16), 10);
                                            const startH = isoToHour(apt.start_time);
                                            const endH = isoToHour(apt.end_time);
                                            const endMin = parseInt(apt.end_time.slice(14, 16), 10);
                                            const durationMins = (endH * 60 + endMin) - (startH * 60 + startMin);
                                            const heightPx = Math.max((durationMins / 60) * 56, 28);
                                            const topPx = (startMin / 60) * 56;

                                            return (
                                                <motion.div
                                                    key={apt.id}
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    whileHover={{ scale: 1.03, zIndex: 10 }}
                                                    onClick={() => onSelectDay(day)}
                                                    style={{
                                                        position: "absolute",
                                                        top: topPx,
                                                        left: 2,
                                                        right: 2,
                                                        height: heightPx,
                                                        background: sc.bg,
                                                        borderLeft: `3px solid ${sc.color}`,
                                                        borderRadius: 6,
                                                        padding: "3px 6px",
                                                        cursor: "pointer",
                                                        overflow: "hidden",
                                                        zIndex: 1,
                                                        textDecoration: apt.status === "cancelled" ? "line-through" : "none",
                                                    }}
                                                >
                                                    <div style={{
                                                        fontSize: 10,
                                                        fontWeight: 600,
                                                        color: sc.color,
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}>
                                                        {apt.lead_name || "Sin nombre"}
                                                    </div>
                                                    {heightPx > 32 && (
                                                        <div style={{
                                                            fontSize: 9,
                                                            color: "var(--text-muted)",
                                                            whiteSpace: "nowrap",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}>
                                                            {apt.product_name || ""}
                                                        </div>
                                                    )}
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
