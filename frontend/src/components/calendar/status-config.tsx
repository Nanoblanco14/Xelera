import React from "react";
import { CalendarCheck, CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    confirmed: { label: "Confirmada", color: "#7a9e8a", bg: "rgba(122,158,138,0.12)", icon: <CalendarCheck size={14} /> },
    completed: { label: "Completada", color: "#10b981", bg: "rgba(16,185,129,0.12)", icon: <CheckCircle size={14} /> },
    cancelled: { label: "Cancelada", color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: <XCircle size={14} /> },
    no_show: { label: "No asistió", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: <AlertTriangle size={14} /> },
    rescheduled: { label: "Reagendada", color: "#6b7280", bg: "rgba(107,114,128,0.12)", icon: <RefreshCw size={14} /> },
};
