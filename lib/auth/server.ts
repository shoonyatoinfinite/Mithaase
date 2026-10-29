import { createNeonAuth } from "@neondatabase/auth/next/server";

const resolvedBaseUrl =
  process.env.NEON_AUTH_BASE_URL ||
  process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL ||
  "https://ep-bold-mode-a1c0x2dr.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth";

const resolvedCookieSecret =
  process.env.NEON_AUTH_COOKIE_SECRET ||
  "88d0344211d77e4394f7a4cece6e2588472216ec9a137f5db1e88fc5db614abe";

export const auth = createNeonAuth({
  baseUrl: resolvedBaseUrl,
  cookies: {
    secret: resolvedCookieSecret,
    sessionDataTtl: 300,
  },
});
