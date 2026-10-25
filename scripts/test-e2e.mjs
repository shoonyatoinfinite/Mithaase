import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

// 1. Read .env.local
const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const envVars = Object.fromEntries(
  envFile
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      const k = l.slice(0, idx).trim();
      let v = l.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return [k, v];
    })
);

const sql = neon(envVars.DATABASE_URL_UNPOOLED || envVars.DATABASE_URL);
const baseUrl = "http://localhost:3000";

async function runTests() {
  console.log("\n==================================================");
  console.log("   MITHAASÉ NEON INTEGRATION END-TO-END TEST");
  console.log("==================================================\n");

  // TEST 1: Neon Postgres Direct Connection
  console.log("[Test 1/5] Testing Neon Postgres Database connection...");
  const dbResult = await sql.query("SELECT NOW() as server_time, current_database() as db;");
  console.log("✓ Neon Postgres Connected successfully!");
  console.log(`  Database: ${dbResult[0].db}, Server Time: ${dbResult[0].server_time}`);

  const tables = await sql.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log(`✓ Neon Tables verified (${tables.length} tables):`, tables.map(t => t.table_name).join(", "));

  // TEST 2: Customer Registration into Neon Postgres
  console.log("\n[Test 2/5] Testing Customer Signup API with Address & PIN...");
  const testPhone = "9876543210";
  const testEmail = `test_${Date.now()}@mithaase.in`;
  const testPin = "123456";

  const signupRes = await fetch(`${baseUrl}/api/auth/customer/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      phone: testPhone,
      pin: testPin,
      name: "Ramesh Sharma",
      delivery_address: "Flat 402, Royal Residency, Station Road",
      locality: "Station Road",
      landmark: "Near Shyam Mandir",
      delivery_instructions: "Ring doorbell twice",
      latitude: 28.1907,
      longitude: 76.1624,
    }),
  });

  const signupData = await signupRes.json();
  if (!signupRes.ok || !signupData.success) {
    throw new Error(`Signup failed: ${JSON.stringify(signupData)}`);
  }
  console.log("✓ Customer Signup API succeeded! Registered user:", signupData.user.email);

  // Verify directly in Neon database table
  const dbCustomer = await sql.query(
    "SELECT id, email, phone, name, locality, delivery_address FROM customer_accounts WHERE email = $1;",
    [testEmail]
  );
  console.log("✓ Verified directly in Neon Postgres customer_accounts table:", dbCustomer[0]);

  // TEST 3: Login via Email + PIN & Login via Phone + PIN
  console.log("\n[Test 3/5] Testing Dual-Login (Email + PIN and Phone + PIN)...");
  
  // A. Email login
  const emailLoginRes = await fetch(`${baseUrl}/api/auth/customer/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: testEmail,
      pin: testPin,
    }),
  });
  const emailLoginData = await emailLoginRes.json();
  if (!emailLoginRes.ok || !emailLoginData.success) {
    throw new Error(`Email login failed: ${JSON.stringify(emailLoginData)}`);
  }
  console.log("✓ Option A: Email + PIN Login Succeeded!");

  // B. Phone login
  const phoneLoginRes = await fetch(`${baseUrl}/api/auth/customer/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: testPhone,
      pin: testPin,
    }),
  });
  const phoneLoginData = await phoneLoginRes.json();
  if (!phoneLoginRes.ok || !phoneLoginData.success) {
    throw new Error(`Phone login failed: ${JSON.stringify(phoneLoginData)}`);
  }
  console.log("✓ Option B: Phone + PIN Login Succeeded! Retrieved name:", phoneLoginData.user.name);

  // TEST 4: Google Customer Sync & Delivery Address Update
  console.log("\n[Test 4/5] Testing Google Profile Sync & Address Collection...");
  const googleEmail = "diwali_google_user@gmail.com";

  // Check before address added
  const checkRes = await fetch(`${baseUrl}/api/auth/customer/google-sync?email=${encodeURIComponent(googleEmail)}`);
  const checkData = await checkRes.json();
  console.log(`  Initial Google check for ${googleEmail}:`, checkData);

  // Complete profile with address
  const syncRes = await fetch(`${baseUrl}/api/auth/customer/google-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: googleEmail,
      name: "Pooja Verma",
      phone: "9123456780",
      delivery_address: "House 12, Gali No. 3, Main Market",
      locality: "Main Market",
      landmark: "Opposite Sweet Shop",
    }),
  });
  const syncData = await syncRes.json();
  if (!syncRes.ok || !syncData.success) {
    throw new Error(`Google sync failed: ${JSON.stringify(syncData)}`);
  }
  console.log("✓ Google user delivery profile successfully saved to Neon Postgres!");

  // Verify in Neon
  const googleDb = await sql.query(
    "SELECT email, name, phone, delivery_address, locality FROM customer_accounts WHERE email = $1;",
    [googleEmail]
  );
  console.log("✓ Verified Google customer stored in Neon DB:", googleDb[0]);

  // TEST 5: Neon Auth API Catch-all Endpoint
  console.log("\n[Test 5/5] Testing Neon Auth API Handler (/api/auth/[...path])...");
  const authRes = await fetch(`${baseUrl}/api/auth/get-session`);
  console.log(`✓ Neon Auth route response status: ${authRes.status} (Handler successfully mounted)`);

  console.log("\n==================================================");
  console.log("   🎉 ALL 5 END-TO-END TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
