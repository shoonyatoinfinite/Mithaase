import { createNeonAuth } from "@neondatabase/auth/next/server";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL || process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL || "",
  cookies: {
    secret:
      process.env.NEON_AUTH_COOKIE_SECRET ||
      process.env.SESSION_SECRET ||
      "default_fallback_session_cookie_secret_key_32_chars",
    sessionDataTtl: 300,
  },
});
