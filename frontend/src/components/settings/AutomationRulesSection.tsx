"use client";
// ═══════════════════════════════════════════════════════════════
//  ⚙️ AUTOMATIZACIONES — reglas proactivas del tenant
//  Plantillas prearmadas (no editor JSON): el dueño elige, activa
//  y listo. Átomos: Toggle, Badge, Button, Modal, EmptyState.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from "react";
import { Workflow, Plus, Trash2 } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import SaveButton from "@/components/ui/SaveButton";
import { Toggle, Badge, Button, Modal, EmptyState } from "@/components/ui";

interface Rule {
    id?: string;
    name: string;
    enabled: boolean;
    trigger_type: "event" | "schedule";
    trigger_event: string;
    conditions: { all: Array<{ field: string; op: string; value: unknown }> };
    action_type: string;
    action_params: Record<string, unknown>;
    cooldown_hours: number;
}

// ── Plantillas prearmadas (multi-industria) ──────────────────
const RULE_TEMPLATES: Array<{ emoji: string; desc: string; rule: Omit<Rule, "id"> }> = [
    {
        emoji: "🔔",
        desc: "Avísame por WhatsApp cuando un lead confirme una cita",
        rule: {
            name: "Aviso al dueño: cita agendada",
            enabled: true,
            trigger_type: "event",
            trigger_event: "appointment_booked",
            conditions: { all: [] },
            action_type: "notify_owner",
            action_params: { reason: "¡Nueva cita agendada por el agente! 📅" },
            cooldown_hours: 1,
        },
    },
    {
        emoji: "📈",
        desc: "Notificación interna cuando un lead avanza de etapa",
        rule: {
            name: "Notificar avance de etapa",
            enabled: true,
            trigger_type: "event",
            trigger_event: "stage_changed",
            conditions: { all: [{ field: "metadata.by", op: "eq", value: "ai" }] },
            action_type: "create_notification",
            action_params: { message: "📈 {nombre} avanzó de etapa en el pipeline" },
            cooldown_hours: 4,
        },
    },
    {
        emoji: "💤",
        desc: "Reactivar leads sin actividad hace más de 3 días (template)",
        rule: {
            name: "Reactivación 72h",
            enabled: true,
            trigger_type: "schedule",
            trigger_event: "inactive_lead",
            conditions: {
                all: [
                    { field: "hours_since_last_message", op: "gte", value: 72 },
                    { field: "chat_status", op: "in", value: ["Interesado activo", "Consultando opciones"] },
                ],
            },
            action_type: "send_template",
            action_params: { event: "follow_up_inactive" },
            cooldown_hours: 120,
        },
    },
    {
        emoji: "🚨",
        desc: "Avísame de inmediato si un cliente pide hablar con humano",
        rule: {
            name: "Alerta doble de handoff",
            enabled: true,
            trigger_type: "event",
            trigger_event: "handoff",
            conditions: { all: [] },
            action_type: "create_notification",
            action_params: { message: "🚨 {nombre} espera atención humana en el Inbox" },
            cooldown_hours: 1,
        },
    },
];

const TRIGGER_LABEL: Record<string, string> = {
    appointment_booked: "Cita agendada",
    stage_changed: "Cambio de etapa",
    handoff: "Derivado a humano",
    lead_created: "Lead nuevo",
    message_received: "Mensaje recibido",
    bot_replied: "Bot respondió",
    inactive_lead: "Lead inactivo (barrido)",
};

export default function AutomationRulesSection({ orgId }: { orgId: string }) {
    const [rules, setRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [migrationPending, setMigrationPending] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/automations?org_id=${orgId}`);
                const json = await res.json();
                if (json?.migration_pending) setMigrationPending(true);
                setRules(json?.data || []);
            } catch { /* silencioso */ }
            setLoading(false);
        })();
    }, [orgId]);

    const save = useCallback(async (next: Rule[]) => {
        setSaving("rules");
        setError("");
        try {
            const res = await fetch(`/api/automations?org_id=${orgId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rules: next }),
            });
            const json = await res.json();
            if (!res.ok) setError(json?.error || "Error guardando reglas");
            else { setSaved("rules"); setTimeout(() => setSaved(null), 2500); }
        } catch { setError("Error de conexión"); }
        setSaving(null);
    }, [orgId]);

    const toggleRule = (idx: number) => {
        const next = rules.map((r, i) => (i === idx ? { ...r, enabled: !r.enabled } : r));
        setRules(next);
    };

    const removeRule = (idx: number) => setRules(rules.filter((_, i) => i !== idx));

    const addFromTemplate = (tpl: (typeof RULE_TEMPLATES)[number]) => {
        setRules([...rules, { ...tpl.rule }]);
        setPickerOpen(false);
    };

    return (
        <SectionCard
            icon={<Workflow size={16} />}
            title="Automatizaciones"
            subtitle="Reglas proactivas: cuando pasa X, tu agente hace Y"
            footer={
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setPickerOpen(true)}>
                        Agregar regla
                    </Button>
                    <SaveButton
                        label="Guardar reglas"
                        section="rules"
                        saving={saving}
                        saved={saved}
                        onClick={() => save(rules)}
                    />
                </div>
            }
        >
            {migrationPending && (
                <p style={{ fontSize: "0.74rem", color: "var(--warning)", marginBottom: "12px" }}>
                    ⚠️ Ejecuta la migración <code>20260707_rule_engine.sql</code> para activar el motor.
                </p>
            )}
            {error && (
                <p style={{ fontSize: "0.74rem", color: "var(--danger)", marginBottom: "12px" }}>{error}</p>
            )}

            {loading ? null : rules.length === 0 ? (
                <EmptyState
                    icon={<Workflow size={24} />}
                    title="Sin automatizaciones aún"
                    hint="Agrega una regla prearmada: avisos de citas, reactivación de leads dormidos y más."
                    action={
                        <Button size="sm" icon={<Plus size={14} />} onClick={() => setPickerOpen(true)}>
                            Ver plantillas
                        </Button>
                    }
                />
            ) : (
                rules.map((rule, idx) => (
                    <div key={rule.id || idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <Toggle
                                active={rule.enabled}
                                onToggle={() => toggleRule(idx)}
                                label={rule.name}
                                description={`${TRIGGER_LABEL[rule.trigger_event] || rule.trigger_event} · cooldown ${rule.cooldown_hours}h`}
                                hasBorder={idx > 0}
                            />
                        </div>
                        <Badge size="xs" color={rule.trigger_type === "event" ? "#7a9e8a" : "#6482aa"}>
                            {rule.trigger_type === "event" ? "REACTIVA" : "PROGRAMADA"}
                        </Badge>
                        <button
                            onClick={() => removeRule(idx)}
                            aria-label="Eliminar regla"
                            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))
            )}

            {/* Picker de plantillas */}
            <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Plantillas de automatización">
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {RULE_TEMPLATES.map((tpl) => (
                        <button
                            key={tpl.rule.name}
                            onClick={() => addFromTemplate(tpl)}
                            className="glass-card"
                            style={{
                                display: "flex", alignItems: "center", gap: "12px",
                                padding: "14px 16px", cursor: "pointer", textAlign: "left",
                                border: "0.5px solid var(--border)",
                            }}
                        >
                            <span style={{ fontSize: "1.2rem" }}>{tpl.emoji}</span>
                            <div>
                                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                    {tpl.rule.name}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    {tpl.desc}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </Modal>
        </SectionCard>
    );
}
