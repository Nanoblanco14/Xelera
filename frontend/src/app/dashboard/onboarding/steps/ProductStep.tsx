"use client";

import { Package } from "lucide-react";
import { getTemplate, type IndustryField } from "@/lib/industry-templates";

interface ProductData {
    name: string;
    description: string;
    price: string;
    attributes: Record<string, string>;
}

interface Props {
    industryId: string;
    data: ProductData;
    onChange: (data: ProductData) => void;
}

const inputStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1.5px solid rgba(255,255,255,0.08)",
    color: "#f0f0f5",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "0.9rem",
    width: "100%",
    outline: "none",
} as const;

export default function ProductStep({ industryId, data, onChange }: Props) {
    const template = getTemplate(industryId);
    const catalogLabel = template?.catalogLabel || "Producto";
    const fields: IndustryField[] = template?.industryFields || [];

    const updateAttr = (key: string, value: string) => {
        onChange({ ...data, attributes: { ...data.attributes, [key]: value } });
    };

    return (
        <div className="max-w-xl mx-auto">
            <div className="text-center mb-8">
                <div
                    className="inline-flex items-center justify-center mb-4"
                    style={{
                        width: "64px", height: "64px", borderRadius: "18px",
                        background: "rgba(16,185,129,0.1)",
                        border: "1px solid rgba(16,185,129,0.15)",
                    }}
                >
                    <Package size={32} style={{ color: "#34d399" }} />
                </div>
                <h2 className="text-3xl font-bold mb-3" style={{ color: "#f0f0f5" }}>
                    Agrega tu primer {catalogLabel.toLowerCase()}
                </h2>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "1rem" }}>
                    Tu agente AI usará esta información para responder consultas.
                </p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                        Nombre del {catalogLabel.toLowerCase()}
                    </label>
                    <input type="text" value={data.name} onChange={(e) => onChange({ ...data, name: e.target.value })} placeholder={`Ej: Mi ${catalogLabel}`} style={inputStyle} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                        Descripción
                    </label>
                    <textarea value={data.description} onChange={(e) => onChange({ ...data, description: e.target.value })} placeholder="Describe brevemente tu producto o servicio..." rows={3} style={{ ...inputStyle, resize: "none" as const }} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                        Precio
                    </label>
                    <input type="text" value={data.price} onChange={(e) => onChange({ ...data, price: e.target.value })} placeholder="Ej: $50.000" style={inputStyle} />
                </div>
                {fields.map((field) => (
                    <div key={field.key}>
                        <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                            {field.label}
                        </label>
                        {field.type === "select" ? (
                            <select value={data.attributes[field.key] || ""} onChange={(e) => updateAttr(field.key, e.target.value)} style={inputStyle}>
                                <option value="">Seleccionar...</option>
                                {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        ) : (
                            <input type={field.type} value={data.attributes[field.key] || ""} onChange={(e) => updateAttr(field.key, e.target.value)} placeholder={field.placeholder} style={inputStyle} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
