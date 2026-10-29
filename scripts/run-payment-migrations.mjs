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

async function run() {
  console.log("Running Migration 010 & 011...");

  await sql.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS order_ref text UNIQUE,
      ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
  `);
  console.log("✓ Added order_ref and payment_status to orders");

  await sql.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check') THEN
        ALTER TABLE orders DROP CONSTRAINT orders_payment_status_check;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_payment_status_valid') THEN
        ALTER TABLE orders DROP CONSTRAINT chk_orders_payment_status_valid;
      END IF;
      ALTER TABLE orders
        ADD CONSTRAINT chk_orders_payment_status_valid
        CHECK (payment_status IN ('unpaid', 'pending', 'pending_verification', 'paid', 'failed', 'refunded'));
    END $$;
  `);
  console.log("✓ Updated payment_status check constraint");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id          text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
      attempt_no        int  NOT NULL,
      attempt_ref       text NOT NULL UNIQUE,
      amount_expected   numeric(10,2) NOT NULL,
      amount_received   numeric(10,2),
      payee_vpa         text,
      method            text NOT NULL CHECK (method IN ('qr','intent','manual')),
      app_clicked       text,
      youpi_payment_id  text UNIQUE,
      youpi_order_ref   text,
      upi_txn_ref       text UNIQUE,
      payer_vpa_masked  text,
      status            text NOT NULL DEFAULT 'created'
        CHECK (status IN ('created','launched','pending','verified','failed','expired','mismatch','manual_review','received_expired')),
      created_at        timestamptz NOT NULL DEFAULT now(),
      launched_at       timestamptz,
      verified_at       timestamptz,
      expires_at        timestamptz,
      UNIQUE (order_id, attempt_no)
    );
  `);
  console.log("✓ Created payments table");

  await sql.query(`CREATE INDEX IF NOT EXISTS payments_order_idx ON payments(order_id);`);
  console.log("✓ Created payments index");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS payment_events (
      id          bigserial PRIMARY KEY,
      payment_id  uuid REFERENCES payments(id),
      order_id    text REFERENCES orders(id),
      source      text NOT NULL,
      event       text NOT NULL,
      payload     jsonb,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
  console.log("✓ Created payment_events table");

  await sql.query(`CREATE INDEX IF NOT EXISTS payment_events_order_idx ON payment_events(order_id);`);
  console.log("✓ Created payment_events index");

  await sql.query(`
    UPDATE orders
    SET order_ref = 'MTH-' || to_char(created_at, 'YYYYMMDD') || '-' || upper(substr(md5(id::text || COALESCE(order_number, '')), 1, 6))
    WHERE order_ref IS NULL;
  `);
  console.log("✓ Backfilled order_ref for historical orders");

  await sql.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS queue_status text NOT NULL DEFAULT 'none'
        CHECK (queue_status IN ('none', 'queued', 'active', 'paid', 'expired', 'cancelled')),
      ADD COLUMN IF NOT EXISTS queued_at timestamptz,
      ADD COLUMN IF NOT EXISTS activated_at timestamptz,
      ADD COLUMN IF NOT EXISTS queue_expires_at timestamptz,
      ADD COLUMN IF NOT EXISTS queue_last_heartbeat_at timestamptz;
  `);
  console.log("✓ Added queue columns to orders");

  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_queue_lookup 
      ON orders (queue_status, queued_at) 
      WHERE queue_status IN ('queued', 'active');
  `);

  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_phone_queue
      ON orders (customer_phone, queue_status)
      WHERE queue_status IN ('queued', 'active');
  `);
  console.log("✓ Created queue performance indexes");

  const orderCols = await sql.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'orders'
    ORDER BY ordinal_position;
  `);
  console.log("✓ All orders columns in Neon:", orderCols.map(c => c.column_name));
}

run().catch(console.error);
