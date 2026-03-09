"use client";
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    AreaChart, Area,
} from "recharts";

/* ─── Palette: elegant dark-mode colors ─────────────────────── */
const DONUT_COLORS = [
    "#3b82f6", // blue-500
    "#22c55e", // green-500
    "#f59e0b", // amber-500
    "#ef4444", // red-500
    "#8b5cf6", // violet-500
    "#06b6d4", // cyan-500
    "#ec4899", // pink-500
];

interface StageEntry {
    stage_name: string;
    count: number;
    color: string | null;
}

interface PipelineDonutProps {
    data: StageEntry[];
}

export function PipelineDonut({ data }: PipelineDonutProps) {
    const filtered = data.filter((d) => d.count > 0);
    if (filtered.length === 0) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "220px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                Sin datos aún
            </div>
        );
    }
    return (
        <ResponsiveContainer width="100%" height={240}>
            <PieChart>
                <Pie
                    data={filtered}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="stage_name"
                    strokeWidth={0}
                >
                    {filtered.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={entry.color || DONUT_COLORS[index % DONUT_COLORS.length]}
                        />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{
                        background: "#18181b",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "10px",
                        color: "#f4f4f5",
                        fontSize: "0.78rem",
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((value: number | undefined, name: string | undefined) => [
                        value !== undefined ? `${value} leads` : "",
                        name ?? "",
                    ]) as unknown as undefined}
                />
                <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "0.72rem", color: "#a1a1aa", paddingTop: "12px" }}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}

/* ─── Bar Chart — Leads por Etapa ───────────────────────────── */
interface LeadsBarChartProps {
    data: StageEntry[];
}

export function LeadsBarChart({ data }: LeadsBarChartProps) {
    if (data.length === 0) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "220px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                Sin datos aún
            </div>
        );
    }
    return (
        <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                />
                <XAxis
                    dataKey="stage_name"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={40}
                />
                <YAxis
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                />
                <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{
                        background: "#18181b",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "10px",
                        color: "#f4f4f5",
                        fontSize: "0.78rem",
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((value: number | undefined, name: string | undefined) => [
                        value !== undefined ? `${value} leads` : "",
                        name ?? "",
                    ]) as unknown as undefined}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={52}>
                    {data.map((entry, index) => (
                        <Cell
                            key={`bar-${index}`}
                            fill={entry.color || DONUT_COLORS[index % DONUT_COLORS.length]}
                            fillOpacity={0.85}
                        />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

/* ─── Area Chart — Tendencia de Leads (30 dias) ─────────────── */
interface TrendEntry {
    date: string;
    leads: number;
    messages: number;
}

interface LeadsTrendChartProps {
    data: TrendEntry[];
}

export function LeadsTrendChart({ data }: LeadsTrendChartProps) {
    if (data.length === 0) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "220px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                Sin datos aun
            </div>
        );
    }

    const formatted = data.map((d) => ({
        ...d,
        label: new Date(d.date + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" }),
    }));

    return (
        <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                <defs>
                    <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradMsgs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                    dataKey="label"
                    tick={{ fill: "#71717a", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                />
                <YAxis
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                />
                <Tooltip
                    contentStyle={{
                        background: "#18181b",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "10px",
                        color: "#f4f4f5",
                        fontSize: "0.78rem",
                    }}
                />
                <Area
                    type="monotone"
                    dataKey="leads"
                    name="Leads"
                    stroke="#3b82f6"
                    fill="url(#gradLeads)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#3b82f6" }}
                />
                <Area
                    type="monotone"
                    dataKey="messages"
                    name="Mensajes"
                    stroke="#8b5cf6"
                    fill="url(#gradMsgs)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#8b5cf6" }}
                />
                <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "0.72rem", color: "#a1a1aa", paddingTop: "8px" }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

/* ─── Bar Chart — Horarios Pico ────────────────────────────── */
interface PeakHourEntry {
    hour: number;
    count: number;
}

interface PeakHoursChartProps {
    data: PeakHourEntry[];
}

export function PeakHoursChart({ data }: PeakHoursChartProps) {
    const maxCount = Math.max(...data.map((d) => d.count), 1);
    const formatted = data.map((d) => ({
        ...d,
        label: `${d.hour.toString().padStart(2, "0")}:00`,
        intensity: d.count / maxCount,
    }));

    if (maxCount <= 0) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "220px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                Sin datos aun
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={260}>
            <BarChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                    dataKey="label"
                    tick={{ fill: "#71717a", fontSize: 8 }}
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                />
                <YAxis
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                />
                <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{
                        background: "#18181b",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "10px",
                        color: "#f4f4f5",
                        fontSize: "0.78rem",
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((value: number | undefined) => [
                        value !== undefined ? `${value} mensajes` : "",
                        "Mensajes entrantes",
                    ]) as unknown as undefined}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={20}>
                    {formatted.map((entry, index) => (
                        <Cell
                            key={`peak-${index}`}
                            fill={`rgba(59, 130, 246, ${0.3 + entry.intensity * 0.7})`}
                        />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
