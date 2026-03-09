"use client";
import { createContext, useContext } from "react";
import type { Organization, OrgRole } from "@/lib/types";

export interface OrgContextType {
    organization: Organization;
    role: OrgRole;
    userId: string;
    userEmail?: string;
}

const OrgCtx = createContext<OrgContextType | null>(null);

export function OrgProvider({ value, children }: { value: OrgContextType; children: React.ReactNode }) {
    return <OrgCtx.Provider value={value}>{children}</OrgCtx.Provider>;
}

export function useOrg(): OrgContextType {
    const ctx = useContext(OrgCtx);
    if (!ctx) throw new Error("useOrg must be used within DashboardLayout");
    return ctx;
}
