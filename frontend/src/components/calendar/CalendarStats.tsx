"use client";

import { motion } from "framer-motion";
import { CalendarDays, CalendarClock, CalendarCheck, CheckCircle } from "lucide-react";
import { kpiStyle } from "./types";

/* ═══════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════ */
interface CalendarStatsProps {
    todayCount: number;
    weekCount: number;
    confirmedCount: number;
    completedCount: number;
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
export default function CalendarStats({
    todayCount,
    weekCount,
    confirmedCount,
    completedCount,
}: CalendarStatsProps) {
    const kpis = [
        { label: "Hoy", value: todayCount, icon: <CalendarDays size={20} />, color: "#3b82f6" },
        { label: "Esta semana", value: weekCount, icon: <CalendarClock size={20} />, color: "#8b5cf6" },
        { label: "Confirmadas", value: confirmedCount, icon: <CalendarCheck size={20} />, color: "#10b981" },
        { label: "Completadas", value: completedCount, icon: <CheckCircle size={20} />, color: "#f59e0b" },
    ];

    return (
        <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
            {kpis.map((kpi) => (
                <motion.div
                    key={kpi.label}
                    style={kpiStyle}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 400 }}
                >
                    <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: `${kpi.color}15`, color: kpi.color, flexShrink: 0,
                    }}>
                        {kpi.icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1 }}>
                            {kpi.value}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                            {kpi.label}
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
