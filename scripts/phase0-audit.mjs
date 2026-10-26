import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const match = envFile.match(/(?:DATABASE_URL|DATABASE_URL_UNPOOLED)\s*=\s*["']?([^"'\r\n]+)["']?/);
if (!match) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

const sql = neon(match[1]);

function maskEmail(email) {
  if (!email) return "N/A";
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  return name.slice(0, 2) + "***@" + domain;
}

function maskPhone(phone) {
  if (!phone) return "N/A";
  const clean = phone.replace(/[^0-9]/g, "");
  if (clean.length < 4) return "****";
  return clean.slice(0, 2) + "******" + clean.slice(-2);
}

async function audit() {
  console.log("=== PHASE 0 READ-ONLY DATABASE AUDIT ===\n");

  // 1. Customer Accounts Audit
  const customers = await sql.query(`
    SELECT id, email, phone, pin, password, created_at, updated_at
    FROM customer_accounts;
  `);

  console.log(`1. CUSTOMER ACCOUNTS (Total: ${customers.length})`);
  const maskedCustomers = customers.map(c => ({
    id: c.id,
    email: maskEmail(c.email),
    phone: maskPhone(c.phone),
    has_plain_pin: Boolean(c.pin),
    pin_length: c.pin ? c.pin.length : 0,
    has_password: Boolean(c.password),
    created_at: c.created_at,
  }));
  console.log("Customer records:", maskedCustomers);

  // Check duplicate phones
  const dupPhones = await sql.query(`
    SELECT phone, count(*) as count
    FROM customer_accounts
    GROUP BY phone
    HAVING count(*) > 1;
  `);
  console.log("Duplicate phones:", dupPhones);

  // Check malformed phones (not exactly 10 digits starting with 6-9)
  const malformedPhones = customers.filter(c => {
    const clean = (c.phone || "").replace(/[^0-9]/g, "").slice(-10);
    return !/^[6-9][0-9]{9}$/.test(clean);
  }).map(c => ({
    id: c.id,
    maskedPhone: maskPhone(c.phone),
    rawLength: c.phone ? c.phone.length : 0
  }));
  console.log("Malformed phones (not 10-digit Indian mobile 6-9):", malformedPhones);

  // 2. Orders & UPI Reference Audit
  const orders = await sql.query(`
    SELECT id, order_number, customer_phone, subtotal, delivery_charge, total_amount, payment_method, payment_status, order_status, upi_reference, created_at
    FROM orders;
  `);
  console.log(`\n2. ORDERS (Total: ${orders.length})`);
  const maskedOrders = orders.map(o => ({
    id: o.id,
    order_number: o.order_number,
    maskedPhone: maskPhone(o.customer_phone),
    total_amount: o.total_amount,
    payment_method: o.payment_method,
    payment_status: o.payment_status,
    order_status: o.order_status,
    upi_reference: o.upi_reference ? (o.upi_reference.slice(0, 4) + "****" + o.upi_reference.slice(-4)) : null,
  }));
  console.log("Orders sample/summary:", maskedOrders);

  // Duplicate UPI references
  const dupUpi = await sql.query(`
    SELECT upi_reference, count(*) as count
    FROM orders
    WHERE upi_reference IS NOT NULL AND upi_reference <> ''
    GROUP BY upi_reference
    HAVING count(*) > 1;
  `);
  console.log("Duplicate UPI references:", dupUpi);

  // Inconsistent payment / order states (e.g. delivered but unpaid, cancelled but paid without refund, etc.)
  const inconsistentOrders = orders.filter(o => {
    if (o.order_status === 'delivered' && o.payment_status === 'unpaid' && o.payment_method !== 'cod') return true;
    if (o.order_status === 'cancelled' && o.payment_status === 'paid') return true;
    if (o.payment_status === 'paid' && o.order_status === 'pending_confirmation' && o.payment_method === 'cod') return true;
    return false;
  }).map(o => ({
    id: o.id,
    order_number: o.order_number,
    payment_method: o.payment_method,
    payment_status: o.payment_status,
    order_status: o.order_status
  }));
  console.log("Inconsistent order/payment states:", inconsistentOrders);

  // 3. Product Variants Stock Audit
  const variants = await sql.query(`
    SELECT pv.id, pv.product_id, p.name as product_name, pv.variant_name, pv.price, pv.stock_quantity, pv.reserved_quantity, pv.is_active
    FROM product_variants pv
    LEFT JOIN products p ON pv.product_id = p.id;
  `);
  console.log(`\n3. PRODUCT VARIANTS (Total: ${variants.length})`);

  const negativeStock = variants.filter(v => v.stock_quantity < 0 || v.reserved_quantity < 0);
  console.log("Negative stock variants:", negativeStock);

  const lowStock = variants.filter(v => v.stock_quantity <= 5).map(v => ({
    product_name: v.product_name,
    variant_name: v.variant_name,
    stock_quantity: v.stock_quantity,
    reserved_quantity: v.reserved_quantity,
    price: v.price
  }));
  console.log("Low/Zero stock variants count:", lowStock.length);
}

audit().catch(console.error);
