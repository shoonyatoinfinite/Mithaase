import { createNeonAuth } from "@neondatabase/auth/next/server";

const resolvedBaseUrl =
  process.env.NEON_AUTH_BASE_URL ||
  process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL ||
  "https://ep-bold-mode-a1c0x2dr.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth";

const resolvedCookieSecret =
  process.env.NEON_AUTH_COOKIE_SECRET ||
  process.env.SESSION_SECRET ||
  "default_fallback_session_cookie_secret_key_32_chars";

export const auth = createNeonAuth({
  baseUrl: resolvedBaseUrl,
  cookies: {
    secret: resolvedCookieSecret,
    sessionDataTtl: 300,
  },
});
