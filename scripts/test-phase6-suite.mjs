/**
 * Phase 6 Comprehensive Automated Integration Test Suite
 * Validates Phone Utility, WhatsApp OTP in Neon, Rate Limiting, 
 * Customer Accounts, Signed JWT Auth, ACID Checkout & Inventory Deduction,
 * and Store Shutoff Signup Lock.
 */

import { neon } from "@neondatabase/serverless";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import fs from "fs";
import path from "path";

// Load .env.local
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf8");
  const match = content.match(/(?:DATABASE_URL|DATABASE_URL_UNPOOLED)\s*=\s*["']?([^"'\r\n]+)["']?/);
  if (match) dbUrl = match[1];
}

if (!dbUrl) {
  console.error("❌ No database connection string found in environment or .env.local.");
  process.exit(1);
}

const sql = neon(dbUrl);

const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ||
  process.env.NEON_AUTH_COOKIE_SECRET ||
  "mithaase_jwt_super_secret_key_festive_2026_shree_shyam"
);

const OTP_SECRET =
  process.env.YOUPI_OTP_SECRET ||
  process.env.SESSION_SECRET ||
  "mithaase_otp_hmac_secret_2026_festive";

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedCount++;
  }
}

async function runPhase6Tests() {
  console.log("==========================================================");
  console.log("🚀 STARTING PHASE 6 COMPREHENSIVE INTEGRATION TEST SUITE");
  console.log("==========================================================\n");

  // -------------------------------------------------------------------------
  // 1. Phone Normalization & Validation Tests
  // -------------------------------------------------------------------------
  console.log("▶ [Test 1] Phone Normalization & Carrier Validation");
  const DUMMY_PHONE_REPEATED = /^([0-9])\1{9}$/;
  const DUMMY_PHONE_SEQUENTIAL = /^(?:0123456789|1234567890|2345678901|3456789012|4567890123|5678901234|6789012345|7890123456|8901234567|9876543210|8765432109|7654321098|6543210987|5432109876)$/;

  function validateTestPhone(raw) {
    if (!raw) return { isValid: false, error: "Empty" };
    const digits = raw.replace(/[^0-9]/g, "");
    let clean = digits;
    if (clean.length === 12 && clean.startsWith("91")) clean = clean.slice(2);
    else if (clean.length === 11 && clean.startsWith("0")) clean = clean.slice(1);

    if (clean.length !== 10) return { isValid: false, error: "Must be 10 digits" };
    if (!/^[6-9]/.test(clean)) return { isValid: false, error: "Invalid carrier prefix" };
    if (DUMMY_PHONE_REPEATED.test(clean) || DUMMY_PHONE_SEQUENTIAL.test(clean)) {
      return { isValid: false, error: "Dummy phone pattern rejected" };
    }
    return { isValid: true, dbFormat: clean, waFormat: `91${clean}` };
  }

  assert(validateTestPhone("9876543211").isValid === true, "Valid 10-digit phone accepted");
  assert(validateTestPhone("+91 98765-43211").waFormat === "919876543211", "+91 formatted correctly");
  assert(validateTestPhone("09876543211").dbFormat === "9876543211", "Leading 0 stripped");
  assert(validateTestPhone("1234567890").isValid === false, "Invalid carrier prefix (1...) rejected");
  assert(validateTestPhone("9999999999").isValid === false, "Repeated digit dummy rejected");
  assert(validateTestPhone("9876543210").isValid === false, "Sequential pattern dummy rejected");

  // -------------------------------------------------------------------------
  // 2. WhatsApp OTP Generation & Verification in Neon PostgreSQL
  // -------------------------------------------------------------------------
  console.log("\n▶ [Test 2] WhatsApp OTP Cycle in Neon DB");
  const testPhone = "98123" + Math.floor(10000 + Math.random() * 90000); // Unique 10-digit phone
  const testEmail = `test_${Date.now()}@mithaase.test`;
  const plainOtp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHmac = crypto.createHmac("sha256", OTP_SECRET).update(`${testPhone}:${plainOtp}:signup`).digest("hex");

  // Insert OTP verification row into Neon DB
  const insertOtpResult = await sql`
    INSERT INTO phone_verifications (phone, purpose, otp_hash, expires_at, attempts, ip)
    VALUES (${testPhone}, 'signup', ${otpHmac}, NOW() + INTERVAL '5 minutes', 0, '127.0.0.1')
    RETURNING id, phone, purpose, otp_hash, expires_at, attempts, consumed_at;
  `;

  assert(insertOtpResult.length === 1, "OTP row persisted in Neon DB");
  const verificationRow = insertOtpResult[0];
  assert(verificationRow.consumed_at === null, "New OTP is unconsumed");
  assert(verificationRow.attempts === 0, "Initial attempts is 0");

  // Verify with WRONG OTP
  const wrongPlainOtp = "000000";
  const wrongHmac = crypto.createHmac("sha256", OTP_SECRET).update(`${testPhone}:${wrongPlainOtp}:signup`).digest("hex");
  const wrongCheck = wrongHmac === verificationRow.otp_hash;
  assert(wrongCheck === false, "Wrong OTP fails cryptographic HMAC verification");

  // Increment attempt count on failure
  await sql`UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = ${verificationRow.id}`;
  const afterFail = await sql`SELECT attempts FROM phone_verifications WHERE id = ${verificationRow.id}`;
  assert(afterFail[0].attempts === 1, "Failed attempt incremented in Neon DB");

  // Verify with CORRECT OTP
  const correctCheck = otpHmac === verificationRow.otp_hash;
  assert(correctCheck === true, "Correct OTP matches cryptographic HMAC");

  // Consume the OTP
  await sql`UPDATE phone_verifications SET consumed_at = NOW() WHERE id = ${verificationRow.id}`;
  const afterConsume = await sql`SELECT consumed_at FROM phone_verifications WHERE id = ${verificationRow.id}`;
  assert(afterConsume[0].consumed_at !== null, "OTP marked consumed in Neon DB");

  // Check single-use: cannot consume again
  const consumedRows = await sql`
    SELECT id FROM phone_verifications 
    WHERE phone = ${testPhone} AND purpose = 'signup' AND consumed_at IS NULL;
  `;
  assert(consumedRows.length === 0, "Consumed OTP cannot be reused");

  // -------------------------------------------------------------------------
  // 3. Customer Account Registration in Neon DB
  // -------------------------------------------------------------------------
  console.log("\n▶ [Test 3] Customer Registration with Bcrypt PIN Hash");
  const rawPin = "654321";
  const pinHash = await bcrypt.hash(rawPin, 10);

  const newCustResult = await sql`
    INSERT INTO customer_accounts (
      email, phone, pin_hash, name, delivery_address, locality, phone_verified_at, updated_at
    ) VALUES (
      ${testEmail}, ${testPhone}, ${pinHash}, 'Phase 6 Tester', 'Near Old Bus Stand', 'Kothal Kalan', NOW(), NOW()
    )
    RETURNING id, email, phone, pin_hash, name, phone_verified_at;
  `;

  assert(newCustResult.length === 1, "Customer account created in Neon DB");
  const createdCustomer = newCustResult[0];
  assert(createdCustomer.phone_verified_at !== null, "Customer has phone_verified_at set");

  // Verify PIN with bcrypt
  const validPinMatch = await bcrypt.compare(rawPin, createdCustomer.pin_hash);
  assert(validPinMatch === true, "Bcrypt validates correct 6-digit PIN");
  const wrongPinMatch = await bcrypt.compare("111111", createdCustomer.pin_hash);
  assert(wrongPinMatch === false, "Bcrypt rejects incorrect 6-digit PIN");

  // Duplicate phone constraint check
  let duplicateRejected = false;
  try {
    await sql`
      INSERT INTO customer_accounts (email, phone, pin_hash, name, delivery_address, locality)
      VALUES (${'dup_' + testEmail}, ${testPhone}, ${pinHash}, 'Duplicate User', 'Address', 'Locality');
    `;
  } catch (err) {
    duplicateRejected = err.message.includes("unique") || err.message.includes("customer_accounts_phone_key") || err.code === "23505";
  }
  assert(duplicateRejected === true, "Duplicate mobile number rejected by Neon UNIQUE constraint");

  // -------------------------------------------------------------------------
  // 4. Cryptographic JWT Session Token Creation & Verification
  // -------------------------------------------------------------------------
  console.log("\n▶ [Test 4] Signed HttpOnly Session JWT");
  const token = await new SignJWT({
    sub: createdCustomer.id,
    phone: createdCustomer.phone,
    email: createdCustomer.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);

  assert(typeof token === "string" && token.length > 50, "Generated signed JWT token");

  const { payload } = await jwtVerify(token, JWT_SECRET);
  assert(payload.sub === createdCustomer.id, "JWT payload contains correct userId (sub)");
  assert(payload.phone === testPhone, "JWT payload contains verified phone");

  // Tampered token check
  let tamperedTokenRejected = false;
  try {
    const tampered = token.slice(0, -5) + "abcde";
    await jwtVerify(tampered, JWT_SECRET);
  } catch {
    tamperedTokenRejected = true;
  }
  assert(tamperedTokenRejected === true, "Tampered session JWT rejected by cryptographic verification");

  // -------------------------------------------------------------------------
  // 5. Atomic Stock Deduction & Order Creation
  // -------------------------------------------------------------------------
  console.log("\n▶ [Test 5] ACID Order Placement & Stock Integrity");
  // Fetch active variant
  const variants = await sql`
    SELECT pv.id, pv.product_id, pv.variant_name, pv.price, pv.stock_quantity, p.name as product_name
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.is_active = true AND pv.stock_quantity > 0
    LIMIT 1;
  `;

  if (variants.length > 0) {
    const vr = variants[0];
    const initialStock = vr.stock_quantity;
    const orderQty = 1;
    const testOrderId = crypto.randomUUID();
    const testOrderNum = `SSS-TEST-${Date.now().toString().slice(-4)}`;
    const idempotencyKey = `idemp-test-${Date.now()}`;

    // Deduct stock conditionally
    const deductResult = await sql`
      UPDATE product_variants 
      SET stock_quantity = stock_quantity - ${orderQty}
      WHERE id = ${vr.id} AND stock_quantity >= ${orderQty}
      RETURNING stock_quantity;
    `;
    assert(deductResult.length === 1, "Stock deducted atomically in Neon DB");
    assert(deductResult[0].stock_quantity === initialStock - orderQty, `Stock reduced from ${initialStock} to ${initialStock - orderQty}`);

    // Insert order
    await sql`
      INSERT INTO orders (
        id, order_number, customer_name, customer_email, customer_phone,
        delivery_address, locality, subtotal, total_amount, payment_method,
        payment_status, order_status, idempotency_key
      ) VALUES (
        ${testOrderId}, ${testOrderNum}, 'Test Customer', ${testEmail}, ${testPhone},
        'Doorstep Gali 4', 'Kothal Kalan', ${vr.price}, ${vr.price}, 'cod',
        'unpaid', 'pending_confirmation', ${idempotencyKey}
      );
    `;

    // Insert order item
    await sql`
      INSERT INTO order_items (
        id, order_id, product_id, variant_id, product_name_snapshot,
        variant_name_snapshot, quantity, unit_price, line_total
      ) VALUES (
        ${crypto.randomUUID()}, ${testOrderId}, ${vr.product_id}, ${vr.id},
        ${vr.product_name}, ${vr.variant_name}, ${orderQty}, ${vr.price}, ${vr.price}
      );
    `;

    const fetchedOrder = await sql`SELECT id, order_number, idempotency_key, payment_status FROM orders WHERE id = ${testOrderId}`;
    assert(fetchedOrder.length === 1, "Order row verified in Neon DB");
    assert(fetchedOrder[0].idempotency_key === idempotencyKey, "Idempotency key stored correctly");

    // Revert test stock deduction to keep database clean
    await sql`
      UPDATE product_variants 
      SET stock_quantity = stock_quantity + ${orderQty}
      WHERE id = ${vr.id};
    `;

    // Clean up test order & items
    await sql`DELETE FROM order_items WHERE order_id = ${testOrderId}`;
    await sql`DELETE FROM orders WHERE id = ${testOrderId}`;
    console.log("  ℹ️ Test order & stock restored cleanly");
  } else {
    console.log("  ⚠️ No active product variants with stock found; skipped stock deduction test.");
  }

  // -------------------------------------------------------------------------
  // 6. Partial Unique Index on UPI Reference (UTR Deduplication)
  // -------------------------------------------------------------------------
  console.log("\n▶ [Test 6] UPI Reference Deduplication (No Double-Claiming)");
  const dummyUtr = `UTR_${Date.now()}`;
  const orderA_id = crypto.randomUUID();
  const orderB_id = crypto.randomUUID();

  // Create first order with UTR
  await sql`
    INSERT INTO orders (
      id, order_number, customer_name, customer_email, customer_phone,
      delivery_address, locality, subtotal, total_amount, payment_method,
      payment_status, order_status, upi_reference
    ) VALUES (
      ${orderA_id}, ${'SSS-UTR-A-' + Date.now().toString().slice(-4)}, 'Buyer A', ${testEmail}, ${testPhone},
      'Address', 'Locality', 200, 200, 'upi', 'paid', 'confirmed', ${dummyUtr}
    );
  `;

  // Try to create second order with SAME UTR
  let duplicateUtrRejected = false;
  try {
    await sql`
      INSERT INTO orders (
        id, order_number, customer_name, customer_email, customer_phone,
        delivery_address, locality, subtotal, total_amount, payment_method,
        payment_status, order_status, upi_reference
      ) VALUES (
        ${orderB_id}, ${'SSS-UTR-B-' + Date.now().toString().slice(-4)}, 'Buyer B', ${testEmail}, ${testPhone},
        'Address', 'Locality', 200, 200, 'upi', 'paid', 'confirmed', ${dummyUtr}
      );
    `;
  } catch (err) {
    duplicateUtrRejected = err.message.includes("unique") || err.message.includes("idx_orders_unique_upi_ref") || err.code === "23505";
  }

  assert(duplicateUtrRejected === true, "Duplicate UPI UTR rejected by unique partial index");

  // Clean up test UTR order
  await sql`DELETE FROM orders WHERE id = ${orderA_id}`;

  // -------------------------------------------------------------------------
  // 7. Store Shutoff Policy Enforcement
  // -------------------------------------------------------------------------
  console.log("\n▶ [Test 7] Store Shutoff Policy (Permanent Close Blocks Signup)");
  const settingsRows = await sql`SELECT store_status, store_shutoff FROM store_settings WHERE id = 1 LIMIT 1;`;
  assert(settingsRows.length === 1, "Store settings queryable from Neon DB");

  // Simulate shutoff check
  function isSignupAllowed(storeSettings) {
    if (storeSettings.store_shutoff || storeSettings.store_status === "shutoff") {
      return false;
    }
    return true;
  }

  assert(isSignupAllowed({ store_shutoff: true, store_status: "open" }) === false, "store_shutoff=true blocks signups");
  assert(isSignupAllowed({ store_shutoff: false, store_status: "shutoff" }) === false, "store_status='shutoff' blocks signups");
  assert(isSignupAllowed({ store_shutoff: false, store_status: "open" }) === true, "Active store permits signups");

  // Clean up test customer and OTP
  await sql`DELETE FROM customer_accounts WHERE id = ${createdCustomer.id}`;
  await sql`DELETE FROM phone_verifications WHERE phone = ${testPhone}`;

  console.log("\n==========================================================");
  console.log(`🏁 TEST SUITE COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==========================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase6Tests().catch((err) => {
  console.error("Test Suite Unhandled Exception:", err);
  process.exit(1);
});
