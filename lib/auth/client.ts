"use client";

import { createAuthClient } from "@neondatabase/auth";

export const authClient = createAuthClient(
  process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL ||
    "https://ep-odd-thunder-a107c4vg.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth"
);
