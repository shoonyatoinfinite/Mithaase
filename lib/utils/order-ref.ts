/**
 * Human-readable, collision-resistant order reference generator
 * Format: MTH-YYYYMMDD-XXXX (4 random characters from Base32 safe alphabet)
 */

const ORDER_REF_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateOrderRef(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  let random = "";
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * ORDER_REF_CHARS.length);
    random += ORDER_REF_CHARS[idx];
  }
  return `MTH-${yyyy}${mm}${dd}-${random}`;
}

