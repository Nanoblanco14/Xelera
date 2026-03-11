import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────
export interface AuthContext {
    userId: string;
    orgId: string;
    role: string;
}

interface ApiErrorBody {
    error: string;
    code: string;
}

// ── Structured error responses ────────────────────────────────
export function apiError(
    message: string,
    status: number,
    code?: string
): NextResponse<ApiErrorBody> {
    return NextResponse.json(
        { error: message, code: code || `ERR_${status}` },
        { status }
    );
}

export function unauthorized(detail?: string) {
    return apiError(
        detail || "No autenticado. Inicia sesión para continuar.",
        401,
        "AUTH_REQUIRED"
    );
}

export function forbidden(detail?: string) {
    return apiError(
        detail || "No tienes permiso para acceder a este recurso.",
        403,
        "FORBIDDEN"
    );
}

export function serverError(err: unknown, context: string) {
    console.error(`[API:${context}]`, err);
    // Never leak internal error details to the client
    return apiError("Error interno del servidor", 500, "INTERNAL_ERROR");
}

// ── Auth verification ─────────────────────────────────────────
// Creates a Supabase client from the request cookies, validates
// the user token, and looks up their organization membership.
// Returns { userId, orgId, role } or null + NextResponse error.

export async function authenticateRequest(
    context: string
): Promise<{ auth: AuthContext } | { error: NextResponse }> {
    try {
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll() {
                        // API routes are read-only for cookies — token
                        // refresh is handled by the middleware/proxy layer.
                    },
                },
            }
        );

        // Validate token with Supabase Auth server (not just local JWT)
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            console.warn(`[API:${context}] Auth failed:`, userError?.message || "no user");
            return { error: unauthorized() };
        }

        // Look up organization membership
        const db = getSupabaseAdmin();
        const { data: member, error: memberError } = await db
            .from("org_members")
            .select("organization_id, role")
            .eq("user_id", user.id)
            .limit(1)
            .single();

        if (memberError || !member) {
            console.warn(`[API:${context}] No org membership for user ${user.id}`);
            return { error: forbidden("No tienes una organización asignada.") };
        }

        return {
            auth: {
                userId: user.id,
                orgId: member.organization_id,
                role: member.role,
            },
        };
    } catch (err) {
        console.error(`[API:${context}] Auth exception:`, err);
        return { error: unauthorized("Error verificando autenticación.") };
    }
}

// ── Convenience: auth + org_id match ──────────────────────────
// For routes that receive an org_id from the client (query param
// or body), this ensures the authenticated user actually belongs
// to that organization.

export function verifyOrgAccess(auth: AuthContext, requestedOrgId: string): NextResponse | null {
    if (auth.orgId !== requestedOrgId) {
        console.warn(`[API] Org mismatch: user org ${auth.orgId} vs requested ${requestedOrgId}`);
        return forbidden("No tienes acceso a esta organización.");
    }
    return null; // OK
}
