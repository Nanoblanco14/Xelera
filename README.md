# Xelera — Agentes de Ventas IA para WhatsApp

Plataforma SaaS multi-tenant que permite a empresas conectar su WhatsApp Business y automatizar conversaciones con clientes usando agentes de IA (OpenAI). Cada organizacion configura sus propios agentes, productos y pipeline de ventas. El agente IA filtra prospectos, agenda citas y gestiona leads de forma autonoma.

## Stack Tecnologico

| Capa | Tecnologia |
|------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Estilos | Tailwind CSS v4, Framer Motion |
| Base de datos | Supabase (PostgreSQL + pgvector + RLS) |
| Autenticacion | Supabase Auth (email/password) |
| IA | OpenAI GPT-4o-mini, text-embedding-3-small |
| WhatsApp | Meta Cloud API (Business) |
| Charts | Recharts |
| Drag & Drop | @hello-pangea/dnd |

## Estructura del Proyecto

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── layout.tsx            # Layout global + metadata
│   │   ├── api/                  # API Routes (agents, products, pipeline, webhook, etc.)
│   │   ├── dashboard/            # UI protegida
│   │   │   ├── page.tsx          # Dashboard con metricas y checklist
│   │   │   ├── inbox/            # Chat en tiempo real (polling + Realtime)
│   │   │   ├── pipeline/         # Kanban de leads (drag & drop)
│   │   │   ├── settings/         # Configuracion org/agente/WhatsApp
│   │   │   └── onboarding/       # Flujo guiado de onboarding
│   │   └── login/                # Autenticacion
│   ├── components/               # Componentes reutilizables
│   │   ├── landing/              # Hero, marquee, secciones landing
│   │   ├── settings/             # Paneles de configuracion
│   │   └── chatbot/              # Widget embebible
│   └── lib/                      # Supabase client, OpenAI, tipos, contexto org
│       ├── supabase/             # Clientes Supabase (server/client)
│       ├── industry-templates.ts # Templates por industria con FAQs
│       └── plan-limits.ts        # Limites del plan gratuito
├── public/                       # Assets estaticos
└── supabase/                     # Migraciones SQL para el schema
```

## Requisitos Previos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) (proyecto creado)
- API Key de [OpenAI](https://platform.openai.com) (cada org usa la suya)
- (Opcional) App de WhatsApp Business en [Meta Developers](https://developers.facebook.com)

## Variables de Entorno

Crear el archivo `frontend/.env.local` con las siguientes variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Meta WhatsApp
META_APP_ID=tu_meta_app_id
META_APP_SECRET=tu_meta_app_secret   # Requerido en produccion: firma los webhooks (X-Hub-Signature-256)
META_VERIFY_TOKEN=tu_token_de_verificacion   # Token global para el handshake de verificacion del webhook

# Desarrollo local (opcional)
# Silencia el aviso de webhooks sin firma cuando pruebas sin META_APP_SECRET
WEBHOOK_ALLOW_UNSIGNED=true

# Cron de automatizaciones (recordatorios, follow-ups, sweeper de cola)
CRON_SECRET=un_secreto_largo_aleatorio

# Cola de mensajes: ventana de debounce en ms (default 8000; 0 = sin espera)
MESSAGE_DEBOUNCE_MS=8000

# Observabilidad (opcional — sin DSN, Sentry queda desactivado sin overhead)
SENTRY_DSN=https://...@o0.ingest.sentry.io/0
NEXT_PUBLIC_SENTRY_DSN=https://...@o0.ingest.sentry.io/0

# Billing (Stripe) — sin estas vars los endpoints responden 503 y el plan queda manual
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...      # firma del webhook /api/billing/webhook
STRIPE_PRICE_PRO=price_...           # price mensual del plan Pro
STRIPE_PRICE_BUSINESS=price_...      # price mensual del plan Business
```

> **Seguridad del webhook:** en produccion `META_APP_SECRET` es obligatorio — sin el, el
> webhook no puede verificar que los mensajes vengan realmente de Meta. Para Twilio, la
> firma se verifica automaticamente con el `auth_token` guardado en las credenciales de la org.

> **Importante:** Nunca subas `.env.local` al repositorio. Ya esta incluido en `.gitignore`.
> Las API keys de OpenAI y credenciales de WhatsApp se configuran por organizacion desde el panel de settings.

## Instalacion y Ejecucion Local

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd Inmobiliaria

# 2. Instalar dependencias del frontend
cd frontend
npm install

# 3. Configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con tus credenciales

# 4. Ejecutar las migraciones en Supabase
# Importar los archivos SQL de /supabase en orden desde el dashboard de Supabase

# 5. Levantar el servidor de desarrollo
npm run dev
```

La aplicacion estara disponible en `http://localhost:3000`.

## Funcionalidades Principales

- **Agentes IA configurables** — Cada organizacion crea agentes con prompts personalizados, productos asignados y conexion a WhatsApp.
- **Templates por industria** — Onboarding con templates pre-configurados (inmobiliaria, peluqueria, ecommerce) que incluyen FAQs, pipeline y prompt del agente.
- **Pipeline de ventas (CRM)** — Tablero Kanban drag-and-drop para gestionar leads por etapas.
- **Inbox en tiempo real** — Chat con polling automatico (3s mensajes, 8s conversaciones) + Supabase Realtime.
- **RAG (Retrieval-Augmented Generation)** — Los agentes buscan informacion relevante de productos usando embeddings y pgvector.
- **Webhook multi-tenant** — Endpoint `/api/webhook/[tenantId]` que recibe mensajes de Meta Cloud API y responde con IA.
- **Widget de chatbot** — Componente embebible para sitios web externos.
- **Analytics** — Dashboard con metricas de leads, conversiones y actividad por organizacion.
- **Multi-tenancy** — Aislamiento de datos por organizacion usando Row Level Security de Supabase.
- **Onboarding guiado** — Flujo paso a paso: industria → agente → API key → WhatsApp → listo.
- **Guia Meta Business** — Instrucciones paso a paso para configurar WhatsApp Business API.

## Arquitectura de mensajes (Fase 1)

El webhook de WhatsApp responde **200 en <1 segundo**: verifica firma, deduplica,
asegura el lead, persiste el mensaje y lo encola en `inbound_message_buffer`.
Un timer diferido (`after()` de Next) espera la ventana de debounce
(`MESSAGE_DEBOUNCE_MS`, 8 s por defecto); si el cliente envió una ráfaga de
mensajes, se procesan como **un solo turno de OpenAI** (una respuesta coherente
en vez de 3 que se pisan). Red de seguridad: el sweeper del cron rescata lotes
cuyo timer haya muerto (>90 s sin procesar).

Si la tabla de cola no existe (migración pendiente), el webhook degrada al
procesamiento inline original sin perder mensajes.

**✓✓ Estados de entrega (Outbox)**: cada envío guarda su wamid en
`lead_messages.provider_message_id`; los webhooks de `statuses` de Meta
actualizan `delivery_status` (sent → delivered → read, con monotonicidad ante
webhooks fuera de orden; `failed` persiste el error). El inbox muestra los
checks estilo WhatsApp (✓ / ✓✓ gris / ✓✓ azul / ⚠ con tooltip) y avanzan en
vivo vía Realtime. Los fallos generan alerta centralizada: Sentry + notificación
in-app deduplicada (máx. 1 cada 6 h), con detección específica de token de Meta
vencido. Migración requerida: `supabase/migrations/20260702_outbox_status.sql`.

**🎤 Notas de voz (Whisper)**: los audios de WhatsApp (Meta) se transcriben
automáticamente — descarga vía Graph API (límite 16 MB), Whisper (`whisper-1`,
español) y el texto entra al flujo normal con prefijo `🎤` (visible en el
inbox). Los audios consecutivos se agrupan por el mismo debounce. Cualquier
fallo (audio corrupto, muy largo, token vencido, timeout) degrada a un
placeholder que hace que el bot pida la consulta por texto — la conversación
nunca se corta. Con el bot pausado el audio igual se transcribe para que el
humano lo lea. Telemetría: filas `whisper-1`/`transcription` en `ai_usage_log`
(convención: `total_tokens` = segundos de audio).

Telemetría: cada completion/embedding registra sus tokens en `ai_usage_log`
(costo por tenant). Errores críticos van a Sentry si `SENTRY_DSN` está definido.

## Memoria de 3 capas + RAG unificado (Fase 2)

El agente recuerda a cada cliente en tres niveles:

| Capa | Almacenamiento | Contenido |
|------|----------------|-----------|
| Corta | `lead_messages` (últimos 15) | La conversación en curso |
| Media | `leads.conversation_summary` | Resumen progresivo (se actualiza cada ~10 mensajes) — las conversaciones largas no pierden el inicio |
| Larga | `lead_memories` | Hechos persistentes ("presupuesto 3.000 UF", "prefiere Ñuñoa") — el lead que vuelve a los 2 meses es recordado |

Los hechos se capturan de dos formas: estructurados desde las llamadas a
`gestionar_lead_crm` (sin costo LLM extra) y extracción periódica con LLM
cada ~6 mensajes del cliente (JSON mode, dedup contra hechos conocidos).

**RAG unificado (`knowledge_chunks`)**: las FAQs y el conocimiento scrapeado
ya no van enteros al prompt (hasta 12k chars fijos) — se trocean y embeben al
guardarse, y en cada turno solo se inyectan los fragmentos relevantes vía el
RPC `match_knowledge`. Se reindexa automáticamente al guardar FAQs, al guardar
contenido scrapeado y al completar el onboarding. Sin índice (migración
pendiente u org sin contenido), el prompt cae al modo legacy completo.

Migración requerida: `supabase/migrations/20260702_fase2_memoria.sql`.

## Analítica de eventos (Eje 1)

Event sourcing ligero: el webhook y el procesador escriben en `analytics_events`
(`message_received`, `bot_replied` con latencia percibida, `handoff`,
`stage_changed`, `appointment_booked`, `lead_created`). El cron consolida cada
hora en `daily_org_metrics` (upsert idempotente de hoy + ayer por org).

La sección **Rendimiento del agente IA** en `/dashboard/analytics` lee el
histórico desde el agregado y calcula HOY en vivo: tiempo de respuesta
percibido (debounce incluido), % de resolución sin humano, tokens consumidos
con costo estimado en USD, y la tendencia de 14 días.

Migración requerida: `supabase/migrations/20260702_eje1_analytics.sql`.

## Base de Datos (Supabase)

Tablas principales:

| Tabla | Descripcion |
|-------|-------------|
| `organizations` | Empresas registradas (multi-tenant) |
| `agents` | Agentes IA configurados por org |
| `leads` | Contactos/prospectos capturados |
| `lead_messages` | Mensajes de conversaciones |
| `pipeline_stages` | Etapas del pipeline de ventas |
| `profiles` | Usuarios de la plataforma |
| `products` | Productos/servicios por org |

## Scripts Disponibles

```bash
npm run dev       # Servidor de desarrollo (Next.js)
npm run build     # Build de produccion
npm run start     # Servir build de produccion
npm run lint      # Linter (ESLint)
```

## Deploy

El proyecto esta desplegado en **Vercel**. La rama `main` se despliega automaticamente.

- **Rama de desarrollo:** `redesign`

### Cron de automatizaciones

`frontend/vercel.json` define un cron **cada hora** que invoca `GET /api/appointments/reminders`
(protegido con `CRON_SECRET` — Vercel envia el header `Authorization: Bearer $CRON_SECRET`
automaticamente si la variable existe en el proyecto). Jobs que ejecuta:

1. Recordatorio de cita 24 h antes (template + fallback de texto)
2. Recordatorio de cita 1 h antes
3. Resumen diario al dueno por WhatsApp (leads nuevos, citas de hoy, chats esperando humano)
4. Follow-up post-visita (48 h despues de una cita completada)
5. Reactivacion de leads inactivos (7+ dias sin actividad)
6. Empujon a conversaciones estancadas (~20 h sin respuesta del cliente, antes de que
   cierre la ventana de sesion de 24 h de WhatsApp)
7. Consolidacion de metricas diarias (daily_org_metrics, hoy + ayer, idempotente)
8. Health-check proactivo de tokens Meta: valida el access_token de cada org contra
   Graph API (debug_token + ping al phone_number_id) con cadencia diaria POR ORG
   (marcador en settings — independiente de la hora del cron). Token invalido o que
   vence en <72 h → alerta in-app centralizada (tipo token_health, deduplicada 1/dia)
   + Sentry. El dueno reconecta ANTES de perder el primer mensaje.

> **Nota plan Hobby de Vercel:** los crons solo corren una vez al dia. Para frecuencia
> horaria real usa un cron externo gratuito (p. ej. cron-job.org) apuntando por POST a
> `https://tu-dominio/api/appointments/reminders` con header
> `Authorization: Bearer <CRON_SECRET>`, o sube a Vercel Pro.

Ademas, cuando un lead pide atencion humana el webhook pausa el bot para ese chat y envia
una **alerta inmediata por WhatsApp al dueno** (configurable en Settings → Citas → Notificaciones).

## Marca

- **Nombre:** Xelera
- **Concepto:** Velocidad + excelencia en ventas conversacionales
- **Colores:** Verde sage (#7a9e8a) sobre fondo oscuro (#0a0a09)
- **Tipografia:** Playfair Display (titulos) + Geist (cuerpo)
