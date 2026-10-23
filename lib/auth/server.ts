import { createNeonAuth } from "@neondatabase/auth/next/server";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL || "https://placeholder.neonauth.tech",
  cookies: {
    secret:
      process.env.NEON_AUTH_COOKIE_SECRET ||
      "f32ee6323e832bdaf4fd4d75ed72808287baed38432dc382ed39ae568f6236e6",
    sessionDataTtl: 300,
  },
});
