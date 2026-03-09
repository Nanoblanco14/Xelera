"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, MessageCircle, Package, Bot, Key } from "lucide-react";

interface SetupStatus {
    hasAgent: boolean;
    hasProduct: boolean;
    hasApiKey: boolean;
    hasWhatsApp: boolean;
}

interface Props {
    status: SetupStatus;
    onFinish: () => void;
    loading: boolean;
}

const CHECKLIST = [
    { key: "hasAgent" as const, label: "Asistente AI configurado", icon: Bot },
    { key: "hasProduct" as const, label: "Primer producto agregado", icon: Package },
    { key: "hasApiKey" as const, label: "API Key conectada", icon: Key },
    { key: "hasWhatsApp" as const, label: "WhatsApp conectado", icon: MessageCircle },
];

export default function CompleteStep({ status, onFinish, loading }: Props) {
    const completedCount = Object.values(status).filter(Boolean).length;
    const allDone = completedCount === 4;

    return (
        <div className="max-w-md mx-auto text-center">
            <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                className="inline-flex items-center justify-center mb-6"
                style={{
                    width: "80px", height: "80px", borderRadius: "50%",
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.15)",
                }}
            >
                <CheckCircle2 size={44} style={{ color: "#34d399" }} />
            </motion.div>

            <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold mb-3"
                style={{ color: "#f0f0f5" }}
            >
                {allDone ? "¡Todo listo!" : "¡Casi listo!"}
            </motion.h2>

            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mb-8"
                style={{ color: "rgba(255,255,255,0.45)", fontSize: "1rem" }}
            >
                {allDone
                    ? "Tu asistente AI está configurado y listo para recibir mensajes."
                    : "Completaste la configuración básica. Puedes terminar lo pendiente desde el dashboard."
                }
            </motion.p>

            <div className="space-y-2.5 mb-10 text-left">
                {CHECKLIST.map((item, i) => {
                    const done = status[item.key];
                    return (
                        <motion.div
                            key={item.key}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 + i * 0.08 }}
                            className="flex items-center gap-3"
                            style={{
                                padding: "14px 18px",
                                borderRadius: "14px",
                                background: done ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.02)",
                                border: `1.5px solid ${done ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)"}`,
                            }}
                        >
                            <div
                                className="flex items-center justify-center flex-shrink-0"
                                style={{
                                    width: "32px", height: "32px", borderRadius: "50%",
                                    background: done ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)",
                                }}
                            >
                                <item.icon size={16} style={{ color: done ? "#34d399" : "rgba(255,255,255,0.2)" }} />
                            </div>
                            <span className="text-sm font-medium" style={{ color: done ? "#34d399" : "rgba(255,255,255,0.3)" }}>
                                {item.label}
                            </span>
                            {done && <CheckCircle2 size={16} style={{ color: "#34d399", marginLeft: "auto" }} />}
                        </motion.div>
                    );
                })}
            </div>

            <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onFinish}
                disabled={loading}
                className="inline-flex items-center gap-2 font-semibold text-white"
                style={{
                    padding: "14px 36px",
                    borderRadius: "14px",
                    fontSize: "1rem",
                    background: "linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)",
                    border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.6 : 1,
                    boxShadow: "0 4px 20px rgba(59,130,246,0.35)",
                }}
            >
                {loading ? "Guardando..." : "Ir al Dashboard"}
                {!loading && <ArrowRight size={18} />}
            </motion.button>
        </div>
    );
}
