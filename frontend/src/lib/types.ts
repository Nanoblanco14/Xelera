// ============================================================
// SaaS Multi-Tenant AI Agent Platform — TypeScript Types
// ============================================================

// ── Core Multi-Tenancy ─────────────────────────────────────

export interface Organization {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    openai_api_key: string;
    whatsapp_provider: 'twilio' | 'meta';
    whatsapp_credentials: Record<string, string>;
    settings: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export type OrgRole = "owner" | "admin" | "viewer";

export interface OrgMember {
    id: string;
    organization_id: string;
    user_id: string;
    role: OrgRole;
    created_at: string;
}

// ── Agents ──────────────────────────────────────────────────

export interface WhatsAppConfig {
    phone_number_id?: string;
    access_token?: string;
    verify_token?: string;
    business_account_id?: string;
}

export type ConversationTone =
    | "Profesional y Formal"
    | "Amigable y Casual"
    | "Entusiasta y Vendedor";

export interface Agent {
    id: string;
    organization_id: string;
    name: string;
    system_prompt: string;
    personality: string;
    language: string;
    model: string;
    temperature: number;
    max_tokens: number;
    welcome_message: string;
    whatsapp_config: WhatsAppConfig;
    booking_url: string | null;
    conversation_tone: ConversationTone | null;
    escalation_rule: string | null;
    scraped_context: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export type AgentCreate = Pick<Agent, "name" | "system_prompt" | "personality" | "language" | "temperature" | "max_tokens" | "welcome_message"> & {
    organization_id: string;
    whatsapp_config?: WhatsAppConfig;
};

export type AgentUpdate = Partial<Omit<AgentCreate, "organization_id"> & Pick<Agent, "model" | "booking_url" | "conversation_tone" | "escalation_rule" | "scraped_context">>;

// ── Products (Agnostic: JSONB attributes) ───────────────────

/** Flexible key-value attributes — any business domain */
export type ProductAttributes = Record<string, string | number | boolean>;

export type ProductStatus = "active" | "inactive" | "archived";

export interface Product {
    id: string;
    organization_id: string;
    name: string;
    description: string;
    attributes: ProductAttributes;
    status: ProductStatus;
    embedding: number[] | null;
    created_at: string;
    updated_at: string;
    files?: ProductFile[];
}

export interface ProductCreate {
    organization_id: string;
    name: string;
    description: string;
    attributes: ProductAttributes;
}

export type ProductUpdate = Partial<Omit<ProductCreate, "organization_id">> & {
    status?: ProductStatus;
};

// ── Product Files ───────────────────────────────────────────

export type FileType = "image" | "pdf" | "document";

export interface ProductFile {
    id: string;
    product_id: string;
    file_type: FileType;
    file_url: string;
    file_name: string;
    file_size: number;
    created_at: string;
}

// ── Conversations & Messages ────────────────────────────────

export type ConversationStatus = "active" | "lead" | "closed";

export interface Conversation {
    id: string;
    agent_id: string;
    client_phone: string;
    client_name: string;
    status: ConversationStatus;
    metadata: Record<string, unknown>;
    started_at: string;
    last_message_at: string;
    // Joined fields (optional, from queries)
    agent?: Agent;
    messages?: Message[];
    message_count?: number;
}

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
    id: string;
    conversation_id: string;
    role: MessageRole;
    content: string;
    media_url: string | null;
    created_at: string;
}

// ── Semantic Search ─────────────────────────────────────────

export interface SearchResult {
    id: string;
    name: string;
    description: string;
    attributes: ProductAttributes;
    similarity: number;
}

export interface SearchRequest {
    query: string;
    organization_id: string;
    threshold?: number;
    limit?: number;
}

// ── API Responses ───────────────────────────────────────────

export interface ApiError {
    error: string;
    details?: string;
}

export interface ApiSuccess<T = unknown> {
    data: T;
}

// ── Auth Context ────────────────────────────────────────────

export interface UserProfile {
    id: string;
    email: string;
    organization: Organization;
    role: OrgRole;
}

// ── Pipeline / CRM ──────────────────────────────────────────

export interface PipelineStage {
    id: string;
    organization_id: string;
    name: string;
    color?: string;
    position: number;
    created_at: string;
    leads?: Lead[];
}

export interface Lead {
    id: string;
    organization_id: string;
    stage_id: string;
    name: string;
    email: string;
    phone: string;
    notes?: string;
    budget?: string;
    appointment_date?: string;
    source?: string;
    chat_status?: string;
    is_bot_paused?: boolean;
    created_at: string;
}

export type LeadMessageRole = 'user' | 'assistant';

export interface LeadMessage {
    id: string;
    lead_id: string;
    role: LeadMessageRole;
    content: string;
    created_at: string;
}

export interface LeadCreate {
    organization_id: string;
    stage_id: string;
    name: string;
    email?: string;
    phone?: string;
    budget?: string;
    appointment_date?: string;
    source?: string;
}

// ── Appointments ──────────────────────────────────────────────

export type AppointmentStatus =
    | "confirmed"
    | "cancelled"
    | "completed"
    | "no_show"
    | "rescheduled";

export interface Appointment {
    id: string;
    organization_id: string;
    lead_id: string;
    product_id: string | null;
    start_time: string;
    end_time: string;
    status: AppointmentStatus;
    notes: string | null;
    cancellation_reason: string | null;
    rescheduled_from_id: string | null;
    confirmation_sent_at: string | null;
    reminder_sent_at: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields (optional, from queries)
    lead?: Lead;
    product?: Product;
    lead_name?: string;
    lead_phone?: string;
    product_name?: string;
}

export interface BusinessDay {
    id?: string;
    organization_id?: string;
    day_of_week: number; // 0=Sun, 1=Mon ... 6=Sat
    is_open: boolean;
    open_time: string;   // "HH:mm"
    close_time: string;  // "HH:mm"
    break_start: string | null;
    break_end: string | null;
}

export interface BlockedDate {
    id: string;
    organization_id: string;
    blocked_date: string; // "YYYY-MM-DD"
    reason: string | null;
    created_at: string;
}

export interface AppointmentConfig {
    slot_duration_minutes: number;
    buffer_minutes: number;
    max_advance_days: number;
    allow_client_cancel: boolean;
    allow_client_reschedule: boolean;
    reschedule_policy: "self_service" | "escalate_to_human";
    daily_digest_enabled: boolean;
    daily_digest_time: string; // "HH:mm"
    owner_phone: string;
    timezone: string;
}

export interface TimeSlot {
    start: string; // ISO 8601
    end: string;   // ISO 8601
}
