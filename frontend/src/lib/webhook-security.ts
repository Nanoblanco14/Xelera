// ═══════════════════════════════════════════════════════════════
//  Webhook Security — signature verification for Meta & Twilio
//
//  Meta (WhatsApp Cloud API) signs every POST with
//  `X-Hub-Signature-256: sha256=<hmac>` using the App Secret.
//  Twilio signs with `X-Twilio-Signature: <base64 hmac-sha1>`
//  computed over the full URL + alphabetically-sorted form params,
//  keyed with the account's Auth Token.
// ═══════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual } from "crypto";

function safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies Meta's X-Hub-Signature-256 header against the raw body.
 */
export function verifyMetaSignature(
    rawBody: string,
    signatureHeader: string | null,
    appSecret: string
): boolean {
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
    const received = signatureHeader.slice("sha256=".length);
    const expected = createHmac("sha256", appSecret)
        .update(rawBody, "utf8")
        .digest("hex");
    return safeCompare(received, expected);
}

/**
 * Verifies Twilio's X-Twilio-Signature header.
 * Algorithm: sort POST params alphabetically by key, concatenate
 * key+value onto the full webhook URL, HMAC-SHA1 with the auth
 * token, base64-encode, compare.
 */
export function verifyTwilioSignature(
    url: string,
    params: Record<string, string>,
    signatureHeader: string | null,
    authToken: string
): boolean {
    if (!signatureHeader) return false;
    const data =
        url +
        Object.keys(params)
            .sort()
            .map((key) => key + params[key])
            .join("");
    const expected = createHmac("sha1", authToken)
        .update(data, "utf8")
        .digest("base64");
    return safeCompare(signatureHeader, expected);
}

/**
 * Reconstructs the public URL Twilio signed, preferring proxy
 * headers (Vercel) over req.url which may be internal.
 */
export function getPublicWebhookUrl(req: Request): string {
    const url = new URL(req.url);
    const host =
        req.headers.get("x-forwarded-host") ||
        req.headers.get("host") ||
        url.host;
    const proto =
        req.headers.get("x-forwarded-proto") ||
        (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}${url.pathname}${url.search}`;
}

/**
 * Escapes text for safe interpolation inside XML (TwiML).
 */
export function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
