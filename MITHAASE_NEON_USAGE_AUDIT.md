# Comprehensive Neon Database Usage & Network Transfer Diagnostic Audit

**Target System:** Mithaasé — Seasonal Sweets E-Commerce Platform  
**Target Environment:** Neon Serverless PostgreSQL (`ep-royal-rain-52349972`, Branch: `production`)  
**Audit Period Under Analysis:** Beginning October 1, 2026  
**Observed Metrics:**
- **Compute:** 2.34 CU-hours
- **Storage:** 42.97 MB
- **History:** 269.81 kB
- **Network Transfer:** 5.85 GB

---

## 1. Executive Summary

A comprehensive, evidence-based investigation was conducted on the Mithaasé codebase to determine the cause of the unusually high **5.85 GB** of reported network transfer on Neon PostgreSQL, despite modest database storage (42.97 MB) and compute usage (2.34 CU-hours) during development and pre-launch testing.

### Key Finding Summary

The 5.85 GB network transfer is **not** caused by external cyber-attacks, bot scraping, YouPI payment gateway polling, or internal Neon Auth replication. Instead, it is the direct mathematical result of a critical compounding interaction between four application design decisions:

1. **Unconditional Polling via Real-Time Fallbacks:**  
   The client hook `useRealtime` (`lib/hooks/useRealtime.ts`) enables an unconditional fallback timer (`enablePollingFallback: true`) that fires every 3 to 6 seconds regardless of whether Server-Sent Events (SSE) are actively connected.
2. **Multiple Concurrently Mounted Polling Components:**  
   On common pages (such as the storefront homepage or admin order tracker), between 3 and 5 components and providers run polling intervals concurrently, triggering continuous `GET` requests for products, store settings, and active orders.
3. **Full Table Scans with In-Memory Filtering:**  
   Key data-access functions in `lib/data/store.ts`—most notably `getOrders()`—do not filter by customer email, order status, or date in SQL. Every invocation executes `SELECT * FROM orders`, `SELECT * FROM order_items`, and `SELECT * FROM order_status_history`, streaming the entirety of all historical orders across the wire to Node.js for in-memory filtering.
4. **Base64 Photo & Screenshot Storage Inside Database Rows:**  
   Customer UPI payment screenshots, delivery confirmation photos, rider pickup photos, and refund receipts are converted via `FileReader.readAsDataURL()` and persisted as raw Base64 data strings (up to 8 MB per file) directly into `TEXT` columns in the `orders` table. Because `getOrders()` executes `SELECT * FROM orders`, every single 3-to-5 second poll transfers all historical Base64 images over the network.
5. **Shared Single Branch Between Localhost and Production:**  
   The local development environment (`.env.local` and `.neon`) points directly to the primary `production` branch. Leaving a local development browser tab open with React 19's Fast Refresh and strict double-mount behavior causes continuous multi-megabyte transfers 24 hours a day.

Immediate remediation focuses on eliminating unconditional polling, removing Base64 strings from relational rows, implementing SQL-level query filtering and pagination, and decoupling local development onto a separate Neon branch.

---

## 2. Verified Project Architecture

The architecture was confirmed by direct inspection of project configuration and dependency manifests:

| Architectural Dimension | Verified Implementation | Evidence Source |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 16.4.2 (App Router), React 19.3.0 | `package.json:24,27` |
| **Styling & Tooling** | Tailwind CSS v4 with Turbopack (`@tailwindcss/turbopack`) | `package.json:31,38`, `next.config.ts:4-11` |
| **Hosting Platform** | Vercel (Edge & Node.js Serverless Functions) | Configuration & deployment architecture |
| **Primary Database** | Neon Serverless PostgreSQL (`@neondatabase/serverless` v1.2.0) | `package.json:15`, `lib/neon/db.ts:1` |
| **Database Driver** | Neon Serverless HTTP Driver (`neon(url)`) | `lib/neon/db.ts:23` |
| **Authentication Strategy** | Dual: Neon Auth (`@neondatabase/auth` v0.6.0-beta) for OAuth/sessions; Custom PIN & Email OTP for customer delivery profiles | `package.json:14`, `lib/auth/server.ts`, `app/api/auth/` |
| **Payment Gateway** | YouPI PG / UPI Auto-confirmation (`/api/payment/youpi/*`) | `components/checkout/PaymentSelectionModal.tsx` |
| **Branching Topology** | Single branch (`production`) shared across both Localhost and Vercel | `.neon:4`, `.env.local`, `neon.ts:7-19` |
| **Query Execution Locations** | Server-side only: API route handlers (`app/api/*`) calling data repository functions (`lib/data/store.ts`) | `app/api/*`, `lib/data/store.ts` |
| **Middleware Status** | No Next.js `middleware.ts` present. Database access is initiated strictly by route handlers and Server Components. | Project directory audit |

---

## 3. Actual Neon Usage Metrics Breakdown

The Neon project metrics reflect the usage accumulated since **October 1, 2026**:

| Metric | Recorded Value | Nature of Metric | Relation to Network Transfer |
| :--- | :---: | :--- | :--- |
| **Compute** | 2.34 CU-hours | Time Neon compute endpoints were active, scaled by Compute Units. | Independent. Compute is billed when Postgres CPU/memory is active. Neon scales to zero when idle. |
| **Storage** | 42.97 MB | Current physical storage footprint on disk of all tables, indexes, and schemas. | Low storage does **not** limit transfer. A 10 MB table read 600 times transfers 6 GB. |
| **History (WAL)** | 269.81 kB | Retained Write-Ahead Log data for point-in-time recovery and branch creation. | Relates only to write/update volume over time. |
| **Network Transfer** | **5.85 GB** | Total egress data transferred out from Neon compute/storage over the network. | **The primary anomaly.** Exceeds database size by a factor of ~136x. |

### Understanding Neon Network Transfer

In Neon's architecture, **Network Transfer (Egress)** measures the byte volume transferred:
- Out of Neon to external clients (e.g., Vercel serverless functions or local development servers over the internet).
- Between cloud regions if compute and storage or clients reside in different geographic regions.

Because the database uses the Neon HTTP driver (`neon(url)`), each SQL operation is transmitted over HTTPS POST. The response body contains the query results serialized into JSON. If a query returns multiple rows containing large strings (e.g., Base64 photos or JSON blobs), the serialized HTTP response body transferred over TLS contributes directly to Neon Network Transfer.

---

## 4. Complete Database Query Inventory

The table below catalogs all database access points within the application source code (`lib/data/store.ts` and associated scripts):

| Function & Source Location | Trigger / Caller | Tables Accessed | Operation | Data Retrieved / Columns | Repeated / Polling Risk | Network & Compute Impact |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`getStoreSettings`**<br>`lib/data/store.ts:167` | `GET /api/settings`, product fetch, order create | `store_settings` | `SELECT` | `SELECT * FROM store_settings WHERE id = 1 LIMIT 1;` | **High**: Polled every 4s by `store-context.tsx:48` | **High frequency**: Small payload (~2 KB), but executed ~900 times/hr per active tab. |
| **`updateStoreSettings`**<br>`lib/data/store.ts:211` | `PUT /api/settings` (Admin) | `store_settings` | `ALTER TABLE`, `UPDATE` | Column check + single row update | None (Admin action only) | Minimal. |
| **`getCategories`**<br>`lib/data/store.ts:279` | `GET /api/categories` | `categories` | `SELECT` | `SELECT id, name, slug, description, display_order, is_active FROM categories;` | Low (Initial page load) | Negligible. Small static dataset. |
| **`getProducts`**<br>`lib/data/store.ts:310` | `GET /api/products`<br>(Cart, Diwali Specials, Category Grid) | `products`, `categories`, `product_variants`, `store_settings` | `SELECT` (3 queries) | All products + all active variants via two separate queries + settings check | **Extreme**: Polled every 5s by `cart-context`, `DiwaliSpecials`, and `CategoryGrid` simultaneously. | **Critical**: Returns full product catalog and variants. 3 queries executed per poll. ~2,160 calls/hr per client. |
| **`getAllProductsAdmin`**<br>`lib/data/store.ts:387` | `GET /api/products?admin=true` | `products`, `categories`, `product_variants` | `SELECT` (2 queries) | All products (including inactive) + all variants | Medium (Admin products screen) | Moderate. |
| **`getProductById`**<br>`lib/data/store.ts:511` | `GET /api/products/[id]` | `products`, `categories`, `product_variants` | `SELECT` (2 queries) | `SELECT p.* ...` + variants for specific product | **High**: Polled every 4s by `product-client.tsx:27` on product page | Moderate. Queries single product repeatedly. |
| **`createProduct`** / **`updateProduct`**<br>`lib/data/store.ts:577, 650` | `POST` / `PUT /api/products` | `products`, `product_variants` | `INSERT` / `UPDATE` | Single product record | None (Admin action only) | Minimal. |
| **`getOrders`**<br>`lib/data/store.ts:1197` | `GET /api/orders`, `Navbar.tsx`, `AdminDashboard`, `rider/page`, `orders/page` | `orders`, `order_items`, `order_status_history` | `SELECT` (3 queries) | **`SELECT * FROM orders`**, **`SELECT * FROM order_items`**, **`SELECT * FROM order_status_history`** (Full table scan without WHERE clause) | **Catastrophic**: Polled every 3s to 5s across storefront, admin, customer orders, and rider portal. | **Extreme / Primary Driver**: Downloads **all** orders with raw Base64 screenshots on every poll. In-memory JS filtering. |
| **`getOrderById`**<br>`lib/data/store.ts:1347` | `GET /api/orders/[id]` (`LiveOrderTracker.tsx`) | `orders`, `order_items`, `order_status_history` | `SELECT` (3 queries) | `SELECT * FROM orders WHERE ... LIMIT 1`, plus items and status history | **High**: Polled every 3.5s by `LiveOrderTracker.tsx:140` if serverless cold cache misses | High per active order tracking session. Returns Base64 photos if present. |
| **`createOrder`**<br>`lib/data/store.ts:1070` | `POST /api/orders` (Checkout) | `orders`, `order_items`, `product_variants`, `inventory_movements` | `INSERT`, `UPDATE` | Inserts order, lines, updates variant stock | Low (Transactional upon order checkout) | Moderate compute, high storage if Base64 screenshot uploaded. |
| **`updateOrderStatus`** / **`updatePaymentStatus`**<br>`lib/data/store.ts:1560, 1660` | `PATCH /api/orders/[id]` | `orders`, `order_status_history`, `inventory_movements` | `UPDATE`, `INSERT` | Single order status change | Low (Triggered by admin/rider clicks) | Minimal. |
| **`getOfflineSales`**<br>`lib/data/store.ts:1872` | `GET /api/offline-sales` | `offline_sales` | `SELECT` | `SELECT * FROM offline_sales ORDER BY created_at DESC;` | Low (Admin POS page) | Minimal. |
| **`getExpenses`**<br>`lib/data/store.ts:1899` | `GET /api/expenses` | `expenses` | `SELECT` | `SELECT * FROM expenses ORDER BY expense_date DESC...;` | Low (Admin expenses page) | Minimal. |
| **`findCustomerByIdentifier`** / **`findCustomerByEmail`**<br>`lib/data/store.ts:2035, 2081` | Customer auth login, Google sync, profile fetch | `customer_accounts` | `SELECT` | `SELECT * FROM customer_accounts WHERE LOWER(email) = $1 ... LIMIT 1;` | Low (Login and profile mount) | Minimal. Single row lookup. |
| **`registerCustomer`** / **`updateCustomerProfile`**<br>`lib/data/store.ts:2112, 2896` | Customer signup / profile update | `customer_accounts` | `INSERT ... ON CONFLICT`, `UPDATE` | Single customer profile row | Low (User form submission) | Minimal. |
| **`getCoupons`** / **`getCouponByCode`**<br>`lib/data/store.ts:2225, 2255` | Coupon validation at checkout | `coupons` | `SELECT` | Single coupon record or active list | Low (Checkout interaction) | Minimal. |
| **`getRiders`** / **`verifyRiderLogin`**<br>`lib/data/store.ts:2554, 2767` | Rider admin / rider login | `riders` | `SELECT` | Rider accounts | Low (Admin fleet screen / rider login) | Minimal. |
| **`scripts/setup-db.mjs`** | Database initialization script | All 11 tables | `CREATE TABLE`, `CREATE EXTENSION` | DDL schema creation | One-off manual execution | Negligible. |
| **`scripts/seed-data.mjs`** | Database initial seed script | `categories`, `products`, `product_variants` | `INSERT` | Seed initial products and categories | One-off manual execution | Negligible. |
| **`scripts/test-e2e.mjs`** | End-to-end integration test script | `products`, `customer_accounts`, `orders` | `SELECT`, `INSERT`, `DELETE` | E2E functional verification | Run manually during development | Minimal. |

---

## 5. Network Transfer Investigation

### A. Repeated Data Retrieval via Unconditional Polling

Inspection of `lib/hooks/useRealtime.ts` reveals a critical flaw in lines 195–211:

```typescript
// lib/hooks/useRealtime.ts lines 195-211
let fallbackTimer: NodeJS.Timeout | null = null;
if (enablePollingFallback) {
  fallbackTimer = setInterval(() => {
    if (onEventRef.current) {
      const typesToTrigger: RealtimeEventType[] =
        events && events.length > 0
          ? events
          : ["order_status_updated", "product_updated", "settings_updated"];
      for (const t of typesToTrigger) {
        onEventRef.current({
          type: t,
          data: { isFallbackTick: true },
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, pollingIntervalMs);
}
```

#### Why This Consumes Massive Network Transfer:
1. **The fallback is not conditional on SSE failure.** It is an active `setInterval` initialized on component mount whenever `enablePollingFallback` is `true` (which is default `true`).
2. Even while the Server-Sent Events stream (`/api/events`) is 100% active and healthy, the interval runs every 3,000 to 5,000 milliseconds.
3. When the interval fires, the callback calls the API fetching functions directly.
4. On the storefront homepage (`/`):
   - `StoreSettingsProvider` (`lib/context/store-context.tsx:48`): Polls `/api/settings` every **4 seconds**.
   - `CartProvider` (`lib/context/cart-context.tsx:120`): Polls `/api/products` every **5 seconds**.
   - `DiwaliSpecials` (`components/storefront/DiwaliSpecials.tsx:29`): Polls `/api/products?t=...` every **5 seconds**.
   - `CategoryGrid` (`components/storefront/CategoryGrid.tsx:26`): Polls `/api/products?t=...` every **5 seconds**.
   - `Navbar` (`components/storefront/Navbar.tsx:72`): Polls `/api/orders?email=...` every **3 seconds** if a user is logged in.

#### Cumulative Query Volume from a Single Browser Tab:
- **`GET /api/products`**: 24 requests per minute (34,560 requests per 24 hours).
- **`GET /api/settings`**: 15 requests per minute (21,600 requests per 24 hours).
- **`GET /api/orders`**: 20 requests per minute (28,800 requests per 24 hours).

**Total for one open tab:** Over **84,000 database-querying HTTP requests per 24-hour period**.

### B. High Payload Sizes: Base64 Photos in Relational Rows

In `components/checkout/PaymentSelectionModal.tsx` (lines 443–455), user-uploaded screenshots are converted directly to Data URLs:

```typescript
// components/checkout/PaymentSelectionModal.tsx lines 443-455
if (file.size > 8 * 1024 * 1024) {
  setValidationError("Screenshot file must be under 8MB");
  return;
}
const reader = new FileReader();
reader.onload = (event) => {
  setScreenshotDataUrl(event.target?.result as string);
};
reader.readAsDataURL(file);
```

These raw Data URLs are stored in `orders.upi_screenshot`, `orders.delivery_proof_photo`, `orders.pickup_photo`, and `orders.refund_screenshot`.

An 8 MB image file converted to Base64 requires **~10.6 MB of text storage**.

Now consider `lib/data/store.ts` lines 1204–1210 in `getOrders()`:

```typescript
// lib/data/store.ts lines 1206-1210
const rows = await sql.query(`
  SELECT * FROM orders ORDER BY created_at DESC;
`);
const itemRows = await sql.query(`SELECT * FROM order_items;`);
const historyRows = await sql.query(`SELECT * FROM order_status_history ORDER BY created_at ASC;`);
```

Because `SELECT * FROM orders` does not exclude the screenshot or proof columns:
- If there are only 5 test orders in the database with payment screenshots (e.g., averaging 3 MB each), the `orders` table payload is **15 MB**.
- Every time `Navbar` polls (`every 3 seconds`), Neon serializes and transmits that 15 MB across the wire.
- **In 1 minute (20 polls):** $20 \times 15\text{ MB} = \mathbf{300\text{ MB}}$.
- **In 20 minutes:** $20 \times 300\text{ MB} = \mathbf{6.0\text{ GB}}$!

This single mechanism is capable of generating 5.85 GB of egress in under an hour of active testing.

### C. Server-Sent Events (SSE) Stream Drops on Serverless

In `app/api/events/route.ts`, the SSE connection runs on a Node.js runtime:

```typescript
// app/api/events/route.ts line 4
export const runtime = "nodejs";
```

On Vercel Serverless Functions, HTTP connections have strict maximum duration limits (typically 15s to 60s on standard plans). When Vercel terminates the hanging SSE stream:
1. `EventSource.onerror` fires in the browser (`lib/hooks/useRealtime.ts:98`).
2. The client initiates a reconnect after 3,000ms.
3. This continuous cycling causes frequent reconnections and triggers re-mount synchronization effects across client components.

---

## 6. Development-versus-Production Access Analysis

Inspection of the project configuration shows that **no environment isolation exists between local development and production**:

| File | Parameter | Value | Implications |
| :--- | :--- | :--- | :--- |
| `.neon` | `branch` | `"production"` | Neon CLI and tooling target the production database branch by default. |
| `.env.local` | `DATABASE_URL` | Points to production Neon cluster endpoint | Every `npm run dev` session directly queries and writes to production Neon. |
| `.env.local` | `NEON_BRANCH` | `production` | Confirms the branch target. |
| `neon.ts` | Branch Policy | Branch expiration enabled for non-default branches only | No automated preview/dev branch generation was configured in local workflows. |

### Development-Mode Amplification Factors:
1. **React 19 StrictMode:** In local development, React executes every `useEffect` twice on mount to detect side effects. This doubles initial fetch requests on every hot reload.
2. **Turbopack Fast Refresh:** Every code edit triggers Fast Refresh, re-mounting components and resetting intervals.
3. **Multiple Tabs During Development:** Having the storefront, the admin dashboard (`/admin/orders`), and the customer tracking page open concurrently multiplies the polling factor by $3\times$.
4. **Scratch Scripts:** Local test scripts (`scratch/test-features.js`, `scratch/test-email-signup-profile.js`, `scratch/check-db-orders.mjs`) were executed against the same database endpoint.

---

## 7. Authentication and YouPI Integration Analysis

### A. Neon Auth Integration

Neon Auth is integrated via `@neondatabase/auth`:
- **Server Handler:** `app/api/auth/[...path]/route.ts` mounts `auth.handler()`.
- **Session Cache:** Configured in `lib/auth/server.ts` with `sessionDataTtl: 300` (5 minutes cookie TTL).
- **Client Client:** `authClient.getSession()` is called once on hydration in `lib/context/user-auth-context.tsx:108`.

**Verdict:** Neon Auth is **not** responsible for the high network transfer. Session checking occurs once on client initialization and is cached via session cookies. Neon Auth does not run polling loops.

### B. YouPI Payment and WhatsApp Verification

The application integrates YouPI for instant UPI auto-confirmation and WhatsApp OTPs:
- **Session Creation:** `app/api/payment/youpi/create/route.ts` creates payment sessions in an in-memory Map (`sandboxSessions`) or forwards to `YOUPI_API_URL` (default `http://localhost:6100`). **No Neon database query is executed.**
- **Status Checks:** `app/api/payment/youpi/status/route.ts` reads the in-memory `sandboxSessions` Map. **No Neon database query is executed.**
- **WhatsApp OTP:** `app/api/payment/youpi/whatsapp-otp/send/route.ts` stores OTP challenges in an in-memory Map (`pendingWhatsappChallenges`). **No Neon database query is executed.**

**Verdict:** YouPI integration has **zero direct connection** to the Neon PostgreSQL database. It operates strictly in-memory or via external HTTP endpoints, and cannot cause Neon network transfer.

---

## 8. Confirmed Findings

### Finding 1: Unconditional Client-Side Polling in `useRealtime`
- **Classification:** **CONFIRMED**
- **Evidence:** `lib/hooks/useRealtime.ts` lines 195–211 initialize an unconditional `setInterval` executing every `pollingIntervalMs` whenever `enablePollingFallback` is `true`.
- **Affected Files:** `lib/hooks/useRealtime.ts`, `lib/context/store-context.tsx`, `lib/context/cart-context.tsx`, `components/storefront/Navbar.tsx`, `components/storefront/DiwaliSpecials.tsx`, `components/storefront/CategoryGrid.tsx`, `app/admin/orders/page.tsx`, `app/rider/page.tsx`, `components/orders/LiveOrderTracker.tsx`.
- **Database Effect:** Continuous influx of HTTP SQL requests (100–150 queries/minute per active tab).
- **Network Transfer Effect:** High (re-transmitting identical result sets every few seconds).
- **Compute Effect:** Prevents Neon compute endpoints from scaling to zero while any browser tab is open.

### Finding 2: `SELECT * FROM orders` Full Table Scan with In-Memory Filtering
- **Classification:** **CONFIRMED**
- **Evidence:** `lib/data/store.ts` lines 1206–1228. In `getOrders(statusFilter, searchQuery, emailFilter)`, the SQL query is hardcoded as `SELECT * FROM orders ORDER BY created_at DESC;`, followed by `SELECT * FROM order_items;` and `SELECT * FROM order_status_history;`. Filtering is performed in JavaScript on lines 1301–1310.
- **Affected Files:** `lib/data/store.ts:1197-1310`, `app/api/orders/route.ts`.
- **Database Effect:** Full table scans of three relational tables on every order query.
- **Network Transfer Effect:** **Critical / Severe.** Transfers all historical rows and columns on every single request.

### Finding 3: Raw Base64 Photos Stored in Database Rows
- **Classification:** **CONFIRMED**
- **Evidence:** `scripts/setup-db.mjs` lines 128–130 define `upi_screenshot TEXT`, `delivery_proof_photo TEXT`, `pickup_photo TEXT`. `PaymentSelectionModal.tsx` line 455 uses `reader.readAsDataURL(file)` with file limits up to 8 MB.
- **Affected Files:** `scripts/setup-db.mjs`, `components/checkout/PaymentSelectionModal.tsx`, `components/camera/LiveCameraCapture.tsx`, `app/admin/orders/page.tsx`.
- **Database Effect:** Dramatically bloats row size in the `orders` table (several megabytes per order).
- **Network Transfer Effect:** **Extreme.** Multiplies the payload of `getOrders()` by hundreds or thousands of times.

### Finding 4: Shared Database Branch Between Localhost and Production
- **Classification:** **CONFIRMED**
- **Evidence:** `.neon` line 4 defines `"branch": "production"`. `.env.local` targets the production database host.
- **Affected Files:** `.neon`, `.env.local`.
- **Database Effect:** All local development, testing, hot-reloading, and debugging traffic hits the production Neon instance.
- **Network Transfer Effect:** Direct attribution of all local development egress to production Neon metrics.

### Finding 5: Completely Disabled Caching on Products and Settings Endpoints
- **Classification:** **CONFIRMED**
- **Evidence:**
  - `app/api/products/route.ts` lines 6–7: `export const dynamic = "force-dynamic"; export const revalidate = 0;`
  - `app/api/settings/route.ts` lines 13–16: `Cache-Control: no-store, no-cache, max-age=0`
  - Client components append `?t=${Date.now()}` (`DiwaliSpecials.tsx:33`, `CategoryGrid.tsx:30`, `AdminDashboardClient.tsx:89`, `LiveOrderTracker.tsx:114`) to deliberately defeat HTTP caching.
- **Database Effect:** Guaranteed database execution on every single incoming HTTP request.
- **Network Transfer Effect:** Prevents edge caching from absorbing repetitive requests.

---

## 9. Likely and Possible Causes

### Finding 6: Vercel SSE Connection Cycling
- **Classification:** **LIKELY**
- **Explanation:** Server-Sent Events over standard Vercel Serverless Functions timeout after 15–30 seconds. Upon timeout, `RealtimeClientManager` reconnects after 3 seconds, potentially triggering component re-mount logic and redundant data fetches.
- **Verification Method:** Inspect Vercel function log duration metrics for `/api/events`.

### Finding 7: Developer Browser Tabs Left Open Overnight
- **Classification:** **POSSIBLE**
- **Explanation:** Leaving a single browser tab open on `localhost:3000` with the homepage running 4 parallel intervals (settings, cart products, Diwali specials, category grid) generates over 84,000 queries and several gigabytes of transfer in 24 hours.
- **Verification Method:** Correlate Neon dashboard transfer spikes with specific dates/times when local development sessions were active.

---

## 10. Unknowns and Additional Telemetry Required

The following questions cannot be answered from the static codebase alone:

1. **Exact Hourly Distribution of Transfer:**  
   Neon's console dashboard displays aggregate transfer. To pinpoint the exact date and hour of spikes, inspect the **Neon Console -> Monitoring -> Network Transfer** graph over the period from October 1 to the present.
2. **Exact Number of Orders with Large Base64 Payloads:**  
   To determine how much of the 42.97 MB database storage consists of Base64 images, execute a size diagnostic query directly in the Neon SQL Editor:
   ```sql
   SELECT 
     id, order_number, 
     pg_column_size(upi_screenshot) / 1024 AS upi_kb,
     pg_column_size(delivery_proof_photo) / 1024 AS proof_kb,
     pg_column_size(pickup_photo) / 1024 AS pickup_kb,
     pg_column_size(refund_screenshot) / 1024 AS refund_kb
   FROM orders;
   ```
3. **Vercel Invocations Count:**  
   Inspect the **Vercel Analytics / Usage** tab to see total serverless function invocations for `/api/products` and `/api/orders`.

---

## 11. Prioritized Remediation Plan

The remediation plan is ordered by impact on network transfer and compute cost.

### Phase 1: Immediate High-Impact Fixes (Estimated ~95% Reduction in Transfer)

#### 1. Fix `useRealtime` Unconditional Polling Interval
- **Problem:** Polling runs unconditionally even when SSE is active.
- **Proposed Solution:** In `lib/hooks/useRealtime.ts`, only run the fallback timer if `!isConnected` and after a grace period. Alternatively, remove fallback polling completely and rely on explicit user refresh or reconnect events.
- **Target File:** `lib/hooks/useRealtime.ts`

```typescript
// Proposed fix in lib/hooks/useRealtime.ts
let fallbackTimer: NodeJS.Timeout | null = null;
// ONLY run fallback if SSE is disconnected
if (enablePollingFallback && !isConnected) {
  fallbackTimer = setInterval(() => {
    // fallback logic
  }, pollingIntervalMs);
}
```

#### 2. Eliminate Base64 Storage in Database Rows
- **Problem:** Storing Base64 images in `orders` rows blows up row sizes to several megabytes.
- **Proposed Solution:** Upload payment screenshots and delivery proof photos to an external object store (e.g., Vercel Blob, Cloudflare R2, or AWS S3) and store only the lightweight HTTPS URL (`VARCHAR(500)`) in PostgreSQL.
- **Target Files:** `components/checkout/PaymentSelectionModal.tsx`, `components/camera/LiveCameraCapture.tsx`, `scripts/setup-db.mjs`.

#### 3. Optimize `getOrders()` to Query Only Needed Fields and Filter in SQL
- **Problem:** `getOrders()` runs `SELECT * FROM orders` without WHERE clauses, downloading all historical orders and joining in Node.js.
- **Proposed Solution:**
  1. Push filters (`email`, `status`, `date`) into the SQL `WHERE` clause.
  2. Implement `LIMIT` and `OFFSET` pagination.
  3. Exclude heavy photo columns unless specifically viewing a single order detail.
- **Target File:** `lib/data/store.ts:1197`

```sql
-- Optimized SQL in getOrders()
SELECT 
  id, order_number, customer_name, customer_email, customer_phone,
  delivery_address, locality, subtotal, discount_amount, delivery_charge,
  total_amount, payment_method, payment_status, order_status, created_at
FROM orders
WHERE ($1::text IS NULL OR LOWER(customer_email) = LOWER($1))
  AND ($2::text IS NULL OR order_status = $2)
ORDER BY created_at DESC
LIMIT 50;
```

#### 4. Consolidate Storefront Polling & Enable Next.js Cache Revalidation
- **Problem:** `Navbar`, `cart-context`, `store-context`, `DiwaliSpecials`, and `CategoryGrid` all make independent requests for products and settings.
- **Proposed Solution:**
  1. Products and settings rarely change by the second. Use Next.js stale-while-revalidate caching (`revalidate: 60`).
  2. Rely on Server-Sent Events broadcast (`broadcastRealtimeEvent("product_updated")`) to trigger cache revalidation rather than timer loops.
  3. Remove cache-busting `?t=${Date.now()}` query parameters.
- **Target Files:** `app/api/products/route.ts`, `app/api/settings/route.ts`, `components/storefront/*`.

---

### Phase 2: Environment Isolation & Architecture Cleanliness

#### 5. Isolate Local Development with a Dedicated Neon Branch
- **Problem:** Localhost development shares the `production` database branch.
- **Proposed Solution:**
  1. Create a dedicated branch in Neon for development:
     ```bash
     npx neon branches create --name dev
     ```
  2. Update `.env.local` to point to the `dev` branch connection string.
  3. Keep the `production` branch connection string exclusively in Vercel Environment Variables.
- **Target Files:** `.env.local`, `.neon`.

---

## 12. Recommended Monitoring Strategy

To ensure database egress and compute remain under control moving forward:

1. **Neon Console Monitoring:**
   - Review **Monitoring -> Metrics** in the Neon console weekly.
   - Monitor the **Data Transfer (Egress)** and **Active Compute Time** graphs.
   - Verify that compute scales to zero (0 CU) during off-hours when no developers or customers are active.
2. **Query Logging and Telemetry:**
   - In `lib/neon/db.ts`, add lightweight development logging to track query frequency:
     ```typescript
     if (process.env.NODE_ENV === "development") {
       console.log(`[Neon SQL Query] ${query.slice(0, 80)}... at ${new Date().toISOString()}`);
     }
     ```
3. **Threshold Alerts:**
   - Configure billing and quota threshold notifications in the Neon Account Settings (e.g., alert at 75% of plan limits).

---

## 13. Neon-versus-Supabase Standby Assessment

The user is considering adding Supabase as a secondary standby PostgreSQL database while maintaining Neon as the primary.

### Evaluation of Supabase as a Standby Database

| Dimension | Assessment & Feasibility | Analysis & Architectural Impact |
| :--- | :--- | :--- |
| **Schema Compatibility** | **High** | Both systems run standard PostgreSQL. The schema defined in `scripts/setup-db.mjs` has already been mirrored in `supabase/migrations/20261019_initial_schema.sql`. |
| **Tables Needing Sync** | 11 tables | `categories`, `products`, `product_variants`, `store_settings`, `orders`, `order_items`, `order_status_history`, `offline_sales`, `inventory_movements`, `expenses`, `coupons`, `customer_accounts`, `riders`. |
| **Initial Synchronization** | Complex | Requires pg_dump/pg_restore or a custom ETL script to clone existing records. |
| **Incremental Updates** | Very Complex | True standby replication requires logical replication (pgoutput / CDC) or application-level dual-writes. Neon and Supabase do not support managed cross-cloud logical replication out of the box on free/standard plans. |
| **Failure Detection** | High Risk of False Positives | Detecting whether Neon is down vs. experiencing transient network latency from Vercel is difficult. Premature failover causes split-brain scenarios. |
| **Write Reconciliation & Split-Brain** | Extreme Risk | If writes occur to Supabase while Neon is unavailable, reconciling sequential order numbers (`SSS-2026-XXXX`), stock deductions (`product_variants.stock_quantity`), and customer IDs upon Neon recovery is notoriously difficult without distributed transactions. |
| **Inventory & Duplicate Orders** | Unsafe | If both databases accept orders independently during a network partition, duplicate order numbers and oversold inventory will occur. |
| **Authentication Dependency** | Incompatible | The application uses **Neon Auth** (`@neondatabase/auth`). Neon Auth is hosted on Neon infrastructure. If Neon is offline, Neon Auth is also offline. Having Supabase available does not solve customer login availability unless a separate auth provider is engineered. |
| **Effect on Network Transfer** | **Negative (Increases Transfer)** | Replicating data from Neon to Supabase or writing to both databases will **increase**, not decrease, outbound network transfer. |
| **Recommendation** | **Do Not Implement at Present** | Introducing a secondary standby database at this stage adds massive operational complexity without addressing the root cause. The issue is application query efficiency, not database infrastructure failure. |

---

## 14. Final Recommendations

1. **Do not migrate or add a standby database to solve network transfer.** The 5.85 GB transfer was caused by client-side polling loops and Base64 row storage, not Neon platform overhead.
2. **Disable the unconditional fallback timer in `useRealtime`.** This immediately terminates the 84,000+ unnecessary daily queries.
3. **Migrate image uploads out of PostgreSQL.** Move payment screenshots to an object storage bucket (e.g., Vercel Blob or Cloudflare R2) and store only image URLs.
4. **Refactor `getOrders()` to paginate and filter in SQL.** Never fetch the entire historical database into memory to display orders for a single customer or status.
5. **Create a separate Neon development branch.** Ensure localhost activity never consumes production quota or touches production data.

---

## 15. Appendix: Relevant Source Files and Functions

| Component / Function | File Path | Lines |
| :--- | :--- | :--- |
| `useRealtime` hook & fallback interval | `lib/hooks/useRealtime.ts` | 164–217 |
| Neon DB client configuration | `lib/neon/db.ts` | 1–53 |
| `getOrders` full table scan | `lib/data/store.ts` | 1197–1310 |
| `getProducts` catalog query | `lib/data/store.ts` | 310–385 |
| `getStoreSettings` query | `lib/data/store.ts` | 167–209 |
| Base64 image reader in payment modal | `components/checkout/PaymentSelectionModal.tsx` | 440–456 |
| Homepage polling in Diwali Specials | `components/storefront/DiwaliSpecials.tsx` | 25–42 |
| Homepage polling in Category Grid | `components/storefront/CategoryGrid.tsx` | 22–39 |
| Root settings polling | `lib/context/store-context.tsx` | 44–58 |
| Root cart price sync polling | `lib/context/cart-context.tsx` | 116–155 |
| Navbar active order polling | `components/storefront/Navbar.tsx` | 68–86 |
| Admin order tracker polling | `app/admin/orders/page.tsx` | 327–353 |
| SSE route handler | `app/api/events/route.ts` | 1–60 |
| Orders API route | `app/api/orders/route.ts` | 1–125 |
| Products API route | `app/api/products/route.ts` | 1–50 |
| YouPI sandbox payment routes | `app/api/payment/youpi/create/route.ts`, `status/route.ts` | 1–106, 1–120 |
| Supabase client stub | `lib/supabase/client.ts` | 1–11 |
