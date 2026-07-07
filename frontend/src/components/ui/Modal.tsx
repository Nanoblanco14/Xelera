"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

// Átomo Modal — envuelve .modal-overlay/.modal-content de globals.css
export default function Modal({
    open,
    onClose,
    title,
    footer,
    children,
    maxWidth = 520,
}: {
    open: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    footer?: React.ReactNode;
    children: React.ReactNode;
    maxWidth?: number;
}) {
    // Cerrar con Escape
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="modal-content"
                        style={{ maxWidth: `${maxWidth}px` }}
                        initial={{ opacity: 0, y: 12, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {title && (
                            <div className="modal-header">
                                <h3 style={{
                                    fontSize: "1rem", fontWeight: 700,
                                    color: "var(--text-primary)",
                                }}>{title}</h3>
                                <button
                                    onClick={onClose}
                                    aria-label="Cerrar"
                                    style={{
                                        background: "none", border: "none",
                                        color: "var(--text-muted)", cursor: "pointer",
                                        padding: "4px", borderRadius: "6px",
                                    }}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        )}
                        <div className="modal-body">{children}</div>
                        {footer && <div className="modal-footer">{footer}</div>}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
