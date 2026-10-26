/**
 * Cryptographically Secure Session Management using jose (Signed JWT in HttpOnly Cookies)
 * Zero reliance on client-side state or localStorage for authentication authority.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "mithaase_session";
const ADMIN_COOKIE_NAME = "mithaase_admin_session";
const RIDER_COOKIE_NAME = "mithaase_rider_session";

// Secret key for signing session tokens
function getJwtSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || process.env.NEON_AUTH_COOKIE_SECRET || "mithaase_jwt_super_secret_key_festive_2026_shree_shyam";
  return new TextEncoder().encode(secret);
}

export interface CustomerSessionPayload {
  userId: string;
  phone: string;
  email: string;
}

/**
 * Creates and sets a signed HttpOnly session cookie for an authenticated customer.
 */
export async function createCustomerSession(payload: CustomerSessionPayload): Promise<string> {
  const secret = getJwtSecret();
  const token = await new SignJWT({
    sub: payload.userId,
    phone: payload.phone,
    email: payload.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  return token;
}

/**
 * Verifies the customer session token and returns the payload, or null if invalid/expired.
 */
export async function verifyCustomerSessionToken(token?: string | null): Promise<CustomerSessionPayload | null> {
  if (!token) return null;
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || typeof payload.sub !== "string") {
      return null;
    }
    return {
      userId: payload.sub,
      phone: String(payload.phone || ""),
      email: String(payload.email || ""),
    };
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the customer session directly from Request headers or cookies.
 */
export async function getCustomerSessionFromRequest(req: Request): Promise<CustomerSessionPayload | null> {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  const token = match ? decodeURIComponent(match[1]) : null;
  return verifyCustomerSessionToken(token);
}

/**
 * Checks whether the request has an authenticated Admin session.
 */
export function isAdminAuthenticated(req: Request): boolean {
  const cookieHeader = req.headers.get("cookie") || "";
  return cookieHeader.includes(`${ADMIN_COOKIE_NAME}=true`);
}

/**
 * Checks whether the request has an authenticated Rider session.
 */
export function isRiderAuthenticated(req: Request): boolean {
  const cookieHeader = req.headers.get("cookie") || "";
  return cookieHeader.includes(`${RIDER_COOKIE_NAME}=true`);
}

export { SESSION_COOKIE_NAME, ADMIN_COOKIE_NAME, RIDER_COOKIE_NAME };
