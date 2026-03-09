"use client";

import { motion } from "framer-motion";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";
import { Check } from "lucide-react";

interface Props {
    selected: string;
    onSelect: (templateId: string) => void;
}

export default function IndustryStep({ selected, onSelect }: Props) {
    return (
        <div>
            <div className="text-center mb-10">
                <h2
                    className="text-3xl font-bold mb-3"
                    style={{ color: "#f0f0f5" }}
                >
                    ¿Cuál es tu industria?
                </h2>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "1rem" }}>
                    Selecciona tu tipo de negocio y configuraremos todo automáticamente.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-5">
                {INDUSTRY_TEMPLATES.map((template, i) => {
                    const isSelected = selected === template.id;
                    return (
                        <motion.button
                            key={template.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07, duration: 0.3 }}
                            whileHover={{ y: -3 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onSelect(template.id)}
                            className="text-left rounded-2xl transition-all duration-200"
                            style={{
                                padding: "28px",
                                background: isSelected
                                    ? "linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(139,92,246,0.08) 100%)"
                                    : "rgba(255,255,255,0.03)",
                                border: isSelected
                                    ? "1.5px solid rgba(59,130,246,0.5)"
                                    : "1.5px solid rgba(255,255,255,0.06)",
                                cursor: "pointer",
                                boxShadow: isSelected
                                    ? "0 4px 24px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05)"
                                    : "inset 0 1px 0 rgba(255,255,255,0.03)",
                            }}
                        >
                            <div className="flex items-start justify-between mb-5">
                                <span className="text-4xl">{template.emoji}</span>
                                {isSelected && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="flex items-center justify-center"
                                        style={{
                                            width: "28px", height: "28px", borderRadius: "50%",
                                            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                                            boxShadow: "0 2px 8px rgba(59,130,246,0.4)",
                                        }}
                                    >
                                        <Check size={16} color="white" strokeWidth={2.5} />
                                    </motion.div>
                                )}
                            </div>
                            <h3
                                className="font-semibold mb-1.5"
                                style={{
                                    fontSize: "1rem",
                                    color: isSelected ? "#93bbfc" : "#e0e0e8",
                                }}
                            >
                                {template.label}
                            </h3>
                            <p
                                className="leading-relaxed"
                                style={{
                                    fontSize: "0.85rem",
                                    color: "rgba(255,255,255,0.35)",
                                }}
                            >
                                {template.description}
                            </p>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
