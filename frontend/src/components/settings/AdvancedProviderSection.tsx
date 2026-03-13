"use client";
import { Wifi, Phone, MessageCircle } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import SaveButton from "@/components/ui/SaveButton";

type WhatsAppProvider = "twilio" | "meta";

const TWILIO_FIELDS = [
    { key: "account_sid", label: "Account SID", placeholder: "Tu Account SID de Twilio" },
    { key: "auth_token", label: "Auth Token", placeholder: "Token de autenticación" },
    { key: "phone_number", label: "Número WhatsApp", placeholder: "+56912345678" },
];
const META_FIELDS = [
    { key: "phone_number_id", label: "Phone Number ID", placeholder: "ID numérico del número" },
    { key: "access_token", label: "Access Token", placeholder: "Token de acceso permanente" },
    { key: "verify_token", label: "Verify Token", placeholder: "Token de verificación del webhook" },
    { key: "business_account_id", label: "Business Account ID", placeholder: "ID de la cuenta de negocio" },
];

const PROVIDERS: { id: WhatsAppProvider; label: string; icon: React.ReactNode }[] = [
    { id: "twilio", label: "Twilio", icon: <Phone size={13} /> },
    { id: "meta", label: "Meta Cloud API", icon: <MessageCircle size={13} /> },
];

interface AdvancedProviderSectionProps {
    provider: WhatsAppProvider;
    credentials: Record<string, string>;
    onProviderChange: (p: WhatsAppProvider) => void;
    onCredentialChange: (key: string, value: string) => void;
    saving: string | null;
    saved: string | null;
    onSave: () => void;
}

export default function AdvancedProviderSection({
    provider, credentials, onProviderChange, onCredentialChange, saving, saved, onSave,
}: AdvancedProviderSectionProps) {
    const credFields = provider === "twilio" ? TWILIO_FIELDS : META_FIELDS;

    return (
        <SectionCard
            icon={<Wifi size={16} />}
            title="Proveedor de WhatsApp (Avanzado)"
            subtitle="Elige tu proveedor y guarda las credenciales"
            footer={
                <SaveButton
                    label="Guardar WhatsApp"
                    section="whatsapp"
                    saving={saving}
                    saved={saved}
                    onClick={onSave}
                />
            }
        >
            {/* Provider toggle */}
            <div className="flex gap-2 mb-5">
                {PROVIDERS.map(({ id, label, icon }) => {
                    const isActive = provider === id;
                    return (
                        <button
                            key={id}
                            onClick={() => onProviderChange(id)}
                            className={`flex-1 py-2.5 px-3.5 rounded-[10px] cursor-pointer transition-all duration-150 text-[0.83rem] flex items-center justify-center gap-2 ${
                                isActive
                                    ? "border-[0.5px] border-[rgba(122,158,138,0.4)] bg-[rgba(122,158,138,0.07)] text-[var(--accent)] font-semibold"
                                    : "border-[0.5px] border-white/[0.06] bg-white/[0.02] text-[var(--text-muted)] font-normal"
                            }`}
                        >
                            {icon}{label}
                        </button>
                    );
                })}
            </div>

            <div className="grid gap-3">
                {credFields.map((f) => (
                    <div className="form-group !mb-0" key={f.key}>
                        <label className="form-label">{f.label}</label>
                        <input
                            className="input"
                            type="text"
                            value={credentials[f.key] || ""}
                            onChange={(e) => onCredentialChange(f.key, e.target.value)}
                            placeholder={f.placeholder}
                        />
                    </div>
                ))}
            </div>
        </SectionCard>
    );
}
