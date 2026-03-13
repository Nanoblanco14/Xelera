"use client";

import { motion } from "framer-motion";
import { CalendarDays, CalendarClock, CalendarCheck, CheckCircle } from "lucide-react";
// types import not needed - using CSS classes now

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
        { label: "Hoy", value: todayCount, icon: <CalendarDays size={20} />, color: "#7a9e8a" },
        { label: "Esta semana", value: weekCount, icon: <CalendarClock size={20} />, color: "#5d8270" },
        { label: "Confirmadas", value: confirmedCount, icon: <CalendarCheck size={20} />, color: "#10b981" },
        { label: "Completadas", value: completedCount, icon: <CheckCircle size={20} />, color: "#f59e0b" },
    ];

    return (
        <div className="stagger-children" style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
            {kpis.map((kpi) => (
                <motion.div
                    key={kpi.label}
                    className="kpi-card"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        flex: 1,
                        minWidth: 160,
                        padding: "16px 18px",
                    }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 400 }}
                >
                    <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: `${kpi.color}15`, border: `0.5px solid ${kpi.color}25`,
                        color: kpi.color, flexShrink: 0,
                    }}>
                        {kpi.icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div className="dashboard-stat" style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1 }}>
                            {kpi.value}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 3, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
                            {kpi.label}
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
