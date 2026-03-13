// ═══════════════════════════════════════════════════════════════
//  📋 WHATSAPP TEMPLATE PRESETS — Predefined per Industry
//  7 templates × 3 industries = 21 ready-to-use presets
//  These pre-fill the template editor so users can quickly
//  create WhatsApp templates via Meta API.
// ═══════════════════════════════════════════════════════════════

export interface TemplatePreset {
    id: string;
    name: string;               // snake_case — used as template name in Meta API
    industry: "real_estate" | "hair_salon" | "ecommerce";
    category: "MARKETING" | "UTILITY";
    language: "es";
    headerText?: string;        // optional header text
    body: string;               // body text, can include {{1}}, {{2}} etc.
    footer?: string;            // optional footer text
    buttons?: { type: "QUICK_REPLY" | "URL"; text: string; url?: string }[];
    description: string;        // short UI description of the template
}

export interface IndustryPresetGroup {
    id: "real_estate" | "hair_salon" | "ecommerce";
    label: string;
    emoji: string;
    presets: TemplatePreset[];
}

// ── Inmobiliaria ────────────────────────────────────────────

const REAL_ESTATE_PRESETS: TemplatePreset[] = [
    {
        id: "re_bienvenida",
        name: "bienvenida_inmobiliaria",
        industry: "real_estate",
        category: "UTILITY",
        language: "es",
        headerText: "¡Bienvenido a {{1}}!",
        body: "Hola {{1}}, gracias por tu interés en nuestras propiedades. 🏠\n\nSoy tu asistente virtual y estoy aquí para ayudarte a encontrar tu hogar ideal.\n\n¿Qué tipo de propiedad estás buscando?\n• Departamento\n• Casa\n• Oficina\n• Terreno\n\nEscríbeme y te muestro las mejores opciones disponibles.",
        footer: "Responde con tu preferencia",
        buttons: [
            { type: "QUICK_REPLY", text: "Ver propiedades" },
            { type: "QUICK_REPLY", text: "Hablar con asesor" },
        ],
        description: "Saludo inicial para nuevos leads interesados en propiedades",
    },
    {
        id: "re_agendar_visita",
        name: "agendar_visita",
        industry: "real_estate",
        category: "UTILITY",
        language: "es",
        headerText: "Visita confirmada ✓",
        body: "Hola {{1}}, tu visita ha sido agendada con éxito. 📋\n\n📍 Propiedad: {{2}}\n📅 Fecha: {{3}}\n⏰ Hora: {{4}}\n📌 Dirección: {{5}}\n\nTe recomendamos llegar 5 minutos antes. Un asesor te estará esperando en la entrada.\n\nSi necesitas reagendar, responde a este mensaje.",
        footer: "{{1}} — Tu asesor inmobiliario",
        buttons: [
            { type: "QUICK_REPLY", text: "Confirmar asistencia" },
            { type: "QUICK_REPLY", text: "Reagendar" },
        ],
        description: "Confirmación de visita agendada con fecha, hora y dirección",
    },
    {
        id: "re_nueva_propiedad",
        name: "nueva_propiedad",
        industry: "real_estate",
        category: "MARKETING",
        language: "es",
        headerText: "🏠 Nueva propiedad disponible",
        body: "Hola {{1}}, tenemos una propiedad nueva que podría interesarte:\n\n🏷️ {{2}}\n📍 Ubicación: {{3}}\n💰 Precio: {{4}}\n📐 Superficie: {{5}}\n🛏️ Habitaciones: {{6}}\n\nEsta propiedad acaba de entrar al mercado y tiene alta demanda. ¿Te gustaría agendar una visita?",
        footer: "Responde para más información",
        buttons: [
            { type: "QUICK_REPLY", text: "Agendar visita" },
            { type: "QUICK_REPLY", text: "Más detalles" },
        ],
        description: "Notificación de nueva propiedad disponible en el mercado",
    },
    {
        id: "re_seguimiento_visita",
        name: "seguimiento_visita",
        industry: "real_estate",
        category: "UTILITY",
        language: "es",
        body: "Hola {{1}}, ¿cómo estás? 😊\n\nQueremos saber tu opinión sobre la propiedad que visitaste:\n📍 {{2}}\n\n¿Qué te pareció? Nos encantaría conocer tu feedback:\n\n1️⃣ Me encantó, quiero avanzar\n2️⃣ Me gustó pero tengo dudas\n3️⃣ No era lo que buscaba\n\nSi tienes preguntas sobre financiamiento, documentación o disponibilidad, estoy aquí para ayudarte.",
        footer: "Tu opinión nos importa",
        buttons: [
            { type: "QUICK_REPLY", text: "Quiero avanzar" },
            { type: "QUICK_REPLY", text: "Tengo dudas" },
        ],
        description: "Follow-up después de una visita para conocer el interés del lead",
    },
    {
        id: "re_oferta_exclusiva",
        name: "oferta_exclusiva_propiedad",
        industry: "real_estate",
        category: "MARKETING",
        language: "es",
        headerText: "🔥 Oferta exclusiva",
        body: "Hola {{1}}, tenemos una oferta especial para ti:\n\n🏠 {{2}}\n💰 Precio anterior: {{3}}\n🏷️ Precio especial: {{4}}\n⏰ Válido hasta: {{5}}\n\nEsta es una oportunidad única — la propiedad tiene condiciones especiales de financiamiento y entrega inmediata.\n\n¿Te interesa conocer más detalles?",
        footer: "Oferta por tiempo limitado",
        buttons: [
            { type: "QUICK_REPLY", text: "Me interesa" },
            { type: "QUICK_REPLY", text: "Ver más ofertas" },
        ],
        description: "Oferta exclusiva o promoción especial en una propiedad",
    },
    {
        id: "re_recordatorio_visita",
        name: "recordatorio_visita",
        industry: "real_estate",
        category: "UTILITY",
        language: "es",
        headerText: "⏰ Recordatorio de visita",
        body: "Hola {{1}}, te recordamos que mañana tienes una visita agendada:\n\n📍 Propiedad: {{2}}\n📅 Fecha: {{3}}\n⏰ Hora: {{4}}\n📌 Dirección: {{5}}\n\nRecuerda llevar tu documento de identidad. Te esperamos puntual. 🙂\n\n¿Confirmas tu asistencia?",
        buttons: [
            { type: "QUICK_REPLY", text: "Confirmo" },
            { type: "QUICK_REPLY", text: "Necesito reagendar" },
        ],
        description: "Recordatorio 24h antes de una visita agendada",
    },
    {
        id: "re_documentacion",
        name: "documentacion_pendiente",
        industry: "real_estate",
        category: "UTILITY",
        language: "es",
        headerText: "📄 Documentación pendiente",
        body: "Hola {{1}}, para avanzar con el proceso de la propiedad {{2}}, necesitamos los siguientes documentos:\n\n📋 Documentos pendientes:\n{{3}}\n\n📅 Fecha límite: {{4}}\n\nPuedes enviarlos por este mismo chat o coordinar una entrega presencial con tu asesor.\n\n¿Tienes alguna duda sobre la documentación?",
        footer: "Estamos para ayudarte",
        buttons: [
            { type: "QUICK_REPLY", text: "Ya los tengo" },
            { type: "QUICK_REPLY", text: "Tengo dudas" },
        ],
        description: "Solicitud de documentos pendientes para el proceso de compra/arriendo",
    },
];

// ── Peluquería / Salón ──────────────────────────────────────

const HAIR_SALON_PRESETS: TemplatePreset[] = [
    {
        id: "hs_bienvenida",
        name: "bienvenida_salon",
        industry: "hair_salon",
        category: "UTILITY",
        language: "es",
        headerText: "¡Bienvenido/a a {{1}}! ✂️",
        body: "Hola {{1}}, ¡qué gusto que nos contactes! 💇‍♀️\n\nSoy el asistente virtual del salón y puedo ayudarte con:\n\n💈 Agendar una cita\n💅 Ver nuestros servicios y precios\n📅 Consultar disponibilidad\n⭐ Conocer nuestras promociones\n\n¿En qué te puedo ayudar hoy?",
        footer: "Responde para comenzar",
        buttons: [
            { type: "QUICK_REPLY", text: "Agendar cita" },
            { type: "QUICK_REPLY", text: "Ver servicios" },
        ],
        description: "Saludo de bienvenida para nuevos clientes del salón",
    },
    {
        id: "hs_confirmacion_cita",
        name: "confirmacion_cita_salon",
        industry: "hair_salon",
        category: "UTILITY",
        language: "es",
        headerText: "Cita confirmada ✓",
        body: "Hola {{1}}, tu cita ha sido agendada exitosamente 🎉\n\n✂️ Servicio: {{2}}\n📅 Fecha: {{3}}\n⏰ Hora: {{4}}\n💈 Estilista: {{5}}\n💰 Precio estimado: {{6}}\n\nTe recomendamos llegar 5 minutos antes. Si necesitas cancelar o reagendar, avísanos con al menos 4 horas de anticipación.\n\n¡Te esperamos!",
        footer: "{{1}} — Tu salón de confianza",
        buttons: [
            { type: "QUICK_REPLY", text: "Confirmar" },
            { type: "QUICK_REPLY", text: "Reagendar" },
        ],
        description: "Confirmación de cita con servicio, fecha, hora y estilista",
    },
    {
        id: "hs_recordatorio_cita",
        name: "recordatorio_cita_salon",
        industry: "hair_salon",
        category: "UTILITY",
        language: "es",
        headerText: "⏰ Recordatorio de cita",
        body: "Hola {{1}}, te recordamos que mañana tienes una cita en nuestro salón:\n\n✂️ Servicio: {{2}}\n📅 Fecha: {{3}}\n⏰ Hora: {{4}}\n💈 Estilista: {{5}}\n\nSi no puedes asistir, por favor avísanos lo antes posible para liberar el horario.\n\n¡Te esperamos! 💇‍♀️",
        buttons: [
            { type: "QUICK_REPLY", text: "Confirmo asistencia" },
            { type: "QUICK_REPLY", text: "Necesito cancelar" },
        ],
        description: "Recordatorio automático 24h antes de la cita",
    },
    {
        id: "hs_promocion",
        name: "promocion_servicio_salon",
        industry: "hair_salon",
        category: "MARKETING",
        language: "es",
        headerText: "🌟 Promoción especial",
        body: "Hola {{1}}, tenemos algo especial para ti 🎁\n\n✨ {{2}}\n💰 Antes: {{3}}\n🏷️ Ahora: {{4}}\n📅 Válido hasta: {{5}}\n\nEsta promo es exclusiva para nuestros clientes. Los cupos son limitados, ¡no te lo pierdas!\n\n¿Te gustaría agendar?",
        footer: "Sujeto a disponibilidad",
        buttons: [
            { type: "QUICK_REPLY", text: "Quiero agendar" },
            { type: "QUICK_REPLY", text: "Ver más promos" },
        ],
        description: "Promoción de nuevo servicio o descuento especial",
    },
    {
        id: "hs_reactivacion",
        name: "reactivacion_cliente_salon",
        industry: "hair_salon",
        category: "MARKETING",
        language: "es",
        body: "Hola {{1}}, ¡te extrañamos en el salón! 💇‍♀️\n\nHace tiempo que no nos visitas y queremos consentirte:\n\n🎁 Te regalamos un {{2}} en tu próxima visita.\n\nTenemos nuevos servicios y estilos que te van a encantar. ¿Qué día te viene bien?\n\nLa promoción es válida hasta {{3}}. ¡Reserva tu espacio! ✨",
        footer: "Te esperamos de vuelta",
        buttons: [
            { type: "QUICK_REPLY", text: "Agendar ahora" },
            { type: "QUICK_REPLY", text: "Ver novedades" },
        ],
        description: "Mensaje para reactivar clientes que no han visitado en un tiempo",
    },
    {
        id: "hs_horario_disponible",
        name: "horario_disponible_salon",
        industry: "hair_salon",
        category: "MARKETING",
        language: "es",
        body: "Hola {{1}}, ¡buenas noticias! 🎉\n\nSe liberó un horario que podría interesarte:\n\n✂️ Servicio disponible: {{2}}\n📅 Fecha: {{3}}\n⏰ Hora: {{4}}\n💈 Estilista: {{5}}\n\nEstos horarios se llenan rápido. ¿Te gustaría reservarlo?\n\nResponde \"Sí\" para asegurar tu lugar. 💇‍♀️",
        buttons: [
            { type: "QUICK_REPLY", text: "Sí, reservar" },
            { type: "QUICK_REPLY", text: "Ver otros horarios" },
        ],
        description: "Notificación de horario cancelado que quedó disponible",
    },
    {
        id: "hs_agradecimiento",
        name: "agradecimiento_visita_salon",
        industry: "hair_salon",
        category: "UTILITY",
        language: "es",
        body: "Hola {{1}}, ¡gracias por visitarnos hoy! 💖\n\nEsperamos que te haya encantado tu {{2}}. Tu opinión es muy importante para nosotros.\n\n¿Podrías regalarnos una reseña? Solo toma 30 segundos y nos ayuda mucho:\n\n⭐⭐⭐⭐⭐\n\nTambién puedes compartir fotos de tu nuevo look. ¡Nos encanta ver los resultados! 📸\n\n¿Cuándo te agendamos la próxima?",
        footer: "Gracias por confiar en nosotros",
        buttons: [
            { type: "QUICK_REPLY", text: "Dejar reseña" },
            { type: "QUICK_REPLY", text: "Agendar próxima" },
        ],
        description: "Agradecimiento post-visita con solicitud de reseña",
    },
];

// ── E-commerce ──────────────────────────────────────────────

const ECOMMERCE_PRESETS: TemplatePreset[] = [
    {
        id: "ec_bienvenida",
        name: "bienvenida_tienda",
        industry: "ecommerce",
        category: "UTILITY",
        language: "es",
        headerText: "¡Bienvenido/a a {{1}}! 🛍️",
        body: "Hola {{1}}, ¡gracias por contactarnos!\n\nSoy tu asistente virtual de compras y puedo ayudarte con:\n\n🔍 Buscar productos\n💰 Consultar precios y stock\n📦 Hacer pedidos\n🚚 Rastrear envíos\n\n¿Qué estás buscando hoy?",
        footer: "Escríbenos para comenzar",
        buttons: [
            { type: "QUICK_REPLY", text: "Ver catálogo" },
            { type: "QUICK_REPLY", text: "Mis pedidos" },
        ],
        description: "Saludo de bienvenida para nuevos clientes de la tienda",
    },
    {
        id: "ec_confirmacion_pedido",
        name: "confirmacion_pedido",
        industry: "ecommerce",
        category: "UTILITY",
        language: "es",
        headerText: "✅ Pedido confirmado",
        body: "Hola {{1}}, tu pedido ha sido confirmado exitosamente 🎉\n\n🛒 Pedido #{{2}}\n📦 Productos: {{3}}\n💰 Total: {{4}}\n💳 Método de pago: {{5}}\n\n📅 Fecha estimada de entrega: {{6}}\n\nTe notificaremos cuando tu pedido sea despachado. Puedes consultar el estado en cualquier momento respondiendo a este mensaje.",
        footer: "Gracias por tu compra",
        buttons: [
            { type: "QUICK_REPLY", text: "Ver estado" },
            { type: "QUICK_REPLY", text: "Necesito ayuda" },
        ],
        description: "Confirmación de pedido con detalles y fecha de entrega estimada",
    },
    {
        id: "ec_envio_despacho",
        name: "envio_despacho",
        industry: "ecommerce",
        category: "UTILITY",
        language: "es",
        headerText: "🚚 ¡Tu pedido va en camino!",
        body: "Hola {{1}}, tu pedido #{{2}} ha sido despachado 📦\n\n🚚 Empresa de envío: {{3}}\n📋 N° de seguimiento: {{4}}\n📅 Entrega estimada: {{5}}\n\nPuedes rastrear tu paquete en cualquier momento con el número de seguimiento.\n\n¿Tienes alguna pregunta sobre tu envío?",
        footer: "Rastreo disponible 24/7",
        buttons: [
            { type: "QUICK_REPLY", text: "Rastrear envío" },
            { type: "QUICK_REPLY", text: "Tengo un problema" },
        ],
        description: "Notificación de despacho con número de tracking",
    },
    {
        id: "ec_producto_nuevo",
        name: "producto_nuevo",
        industry: "ecommerce",
        category: "MARKETING",
        language: "es",
        headerText: "🆕 Nuevo producto disponible",
        body: "Hola {{1}}, acabamos de agregar algo que te va a encantar:\n\n🏷️ {{2}}\n💰 Precio: {{3}}\n📦 Stock disponible: {{4}} unidades\n\n{{5}}\n\n¡Sé de los primeros en tenerlo! Los pedidos se están llenando rápido.\n\n¿Te lo reservamos?",
        footer: "Disponibilidad limitada",
        buttons: [
            { type: "QUICK_REPLY", text: "Lo quiero" },
            { type: "QUICK_REPLY", text: "Ver más productos" },
        ],
        description: "Anuncio de nuevo producto con precio y stock",
    },
    {
        id: "ec_oferta_flash",
        name: "oferta_flash",
        industry: "ecommerce",
        category: "MARKETING",
        language: "es",
        headerText: "⚡ Oferta Flash — Solo hoy",
        body: "Hola {{1}}, ¡oferta relámpago! ⏰\n\n🏷️ {{2}}\n💰 Antes: {{3}}\n🔥 Ahora: {{4}}\n📉 Descuento: {{5}}\n⏰ Termina: {{6}}\n\nEsta oferta es exclusiva por WhatsApp y tiene stock limitado. ¡No te la pierdas!\n\n¿Quieres que te lo reserve?",
        footer: "Stock limitado",
        buttons: [
            { type: "QUICK_REPLY", text: "Comprar ahora" },
            { type: "QUICK_REPLY", text: "Ver más ofertas" },
        ],
        description: "Oferta por tiempo limitado con precio especial",
    },
    {
        id: "ec_carrito_abandonado",
        name: "carrito_abandonado",
        industry: "ecommerce",
        category: "MARKETING",
        language: "es",
        body: "Hola {{1}}, notamos que dejaste algo en tu carrito 🛒\n\n📦 {{2}}\n💰 Total: {{3}}\n\n¡Todavía está disponible! Pero el stock es limitado.\n\n🎁 Si completas tu compra en las próximas 24 horas, te damos envío gratis con el código: {{4}}\n\n¿Te gustaría completar tu pedido?",
        footer: "Tu carrito te espera",
        buttons: [
            { type: "QUICK_REPLY", text: "Completar compra" },
            { type: "QUICK_REPLY", text: "Necesito ayuda" },
        ],
        description: "Recordatorio de carrito abandonado con incentivo de envío gratis",
    },
    {
        id: "ec_resena_producto",
        name: "resena_producto",
        industry: "ecommerce",
        category: "UTILITY",
        language: "es",
        body: "Hola {{1}}, ¿ya recibiste tu pedido #{{2}}? 📦\n\n¡Esperamos que te haya encantado! Tu opinión nos ayuda a mejorar y a otros clientes a decidir.\n\n¿Podrías contarnos qué te pareció?\n⭐⭐⭐⭐⭐\n\nSolo toma un minuto y como agradecimiento te damos un {{3}} de descuento en tu próxima compra. 🎁",
        footer: "Tu opinión importa",
        buttons: [
            { type: "QUICK_REPLY", text: "Dejar reseña" },
            { type: "QUICK_REPLY", text: "Reportar problema" },
        ],
        description: "Solicitar reseña post-compra con descuento de incentivo",
    },
];

// ── Exported grouped data ───────────────────────────────────

export const TEMPLATE_PRESET_GROUPS: IndustryPresetGroup[] = [
    {
        id: "real_estate",
        label: "Inmobiliaria",
        emoji: "🏠",
        presets: REAL_ESTATE_PRESETS,
    },
    {
        id: "hair_salon",
        label: "Peluquería",
        emoji: "💇",
        presets: HAIR_SALON_PRESETS,
    },
    {
        id: "ecommerce",
        label: "E-commerce",
        emoji: "🛍️",
        presets: ECOMMERCE_PRESETS,
    },
];

/** Flat list of all presets */
export const ALL_TEMPLATE_PRESETS: TemplatePreset[] = [
    ...REAL_ESTATE_PRESETS,
    ...HAIR_SALON_PRESETS,
    ...ECOMMERCE_PRESETS,
];
