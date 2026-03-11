"use client";

import { motion } from "framer-motion";
import { Appointment, DAY_NAMES, toDateKey, isSameDay, fmtTime } from "./types";
import { STATUS_CONFIG } from "./status-config";

/* ═══════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════ */
interface MonthViewProps {
    monthGrid: { date: Date; inMonth: boolean }[];
    appointmentsByDay: Record<string, Appointment[]>;
    today: Date;
    selectedDay: Date | null;
    onSelectDay: (date: Date) => void;
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
export default function MonthView({
    monthGrid,
    appointmentsByDay,
    today,
    selectedDay,
    onSelectDay,
}: MonthViewProps) {
    return (
        <div>
            {/* Day headers */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 1,
                marginBottom: 4,
            }}>
                {DAY_NAMES.map((d) => (
                    <div key={d} style={{
                        textAlign: "center",
                        padding: "8px 0",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                    }}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 1,
            }}>
                {monthGrid.map(({ date, inMonth }, idx) => {
                    const key = toDateKey(date);
                    const dayAppts = appointmentsByDay[key] || [];
                    const isToday = isSameDay(date, today);
                    const isSelected = selectedDay && isSameDay(date, selectedDay);

                    return (
                        <motion.div
                            key={idx}
                            onClick={() => onSelectDay(date)}
                            whileHover={{ scale: 1.03, zIndex: 2 }}
                            style={{
                                minHeight: 80,
                                padding: "6px 8px",
                                borderRadius: 10,
                                cursor: "pointer",
                                border: isToday
                                    ? "2px solid #3b82f6"
                                    : isSelected
                                        ? "2px solid rgba(59,130,246,0.4)"
                                        : "1px solid transparent",
                                background: isSelected
                                    ? "rgba(59,130,246,0.06)"
                                    : "transparent",
                                transition: "all 0.15s",
                                position: "relative",
                            }}
                        >
                            <div style={{
                                fontSize: 13,
                                fontWeight: isToday ? 700 : 500,
                                color: !inMonth
                                    ? "var(--text-muted)"
                                    : isToday
                                        ? "#3b82f6"
                                        : "var(--text-primary)",
                                marginBottom: 4,
                            }}>
                                {date.getDate()}
                            </div>
                            {dayAppts.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    {dayAppts.slice(0, 3).map((apt) => {
                                        const sc = STATUS_CONFIG[apt.status] || STATUS_CONFIG.confirmed;
                                        return (
                                            <div
                                                key={apt.id}
                                                style={{
                                                    fontSize: 10,
                                                    padding: "2px 5px",
                                                    borderRadius: 4,
                                                    background: sc.bg,
                                                    color: sc.color,
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {fmtTime(apt.start_time)} {apt.lead_name || "Sin nombre"}
                                            </div>
                                        );
                                    })}
                                    {dayAppts.length > 3 && (
                                        <div style={{
                                            fontSize: 10,
                                            color: "var(--text-muted)",
                                            fontWeight: 500,
                                            paddingLeft: 4,
                                        }}>
                                            +{dayAppts.length - 3} más
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
