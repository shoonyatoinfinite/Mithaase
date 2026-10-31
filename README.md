# 🪔 Mithaasé — Shree Shyam Sweets Hyperlocal E-Commerce & Fleet Suite

A production-grade, hyperlocal festive e-commerce platform and operational suite built for **Shree Shyam Sweets** (Kothal Kalan, Haryana). Powered by **Next.js 16 (Turbopack)**, **Neon Serverless PostgreSQL**, **Neon Auth**, **SMTP Email OTP**, and **Server-Sent Events (SSE)** for real-time delivery tracking.

---

## 🌟 Platform Highlights

### 🛍️ Customer Storefront
- **Festive Experience:** Indian visual aesthetics with earthen diyas, interactive sweet orbit carousel, and subtle celebration animations.
- **Catalogue & Product Variants:** Multi-weight packaging (250g, 500g, 1kg, gift hampers, handi portions) with live inventory status.
- **Smart Cart & Coupon Engine:** Persistent shopping cart with flat ₹21 delivery fee. Includes new-user validation for exclusive first-order coupons (such as `FREEDEL`).
- **Doorstep Map GPS Location Picker:** Interactive map location selector with browser geolocation detection, custom pinpointing, and Google Maps coordinate generation.
- **Email Verification & Account Security:** 3-step progressive onboarding with SMTP one-time verification codes (OTP), 6-digit security PIN, and immutable email identity.
- **Flexible Payments:** UPI QR code payment with customer UTR verification, alongside Cash on Delivery (COD).
- **Live Order & Refund Tracking:** Real-time delivery timeline via Server-Sent Events (SSE). If an order is cancelled, customers receive live updates on their UPI refund status, refund amount, bank transaction reference (UTR), and official transfer screenshot proof.
- **Printable Tax Invoices & Delivery Receipts:** Clean, print-ready bills with order breakdowns, payment verification stamps, real-time doorstep delivery snapshots, and refund proof memos.
- **Clean Session Teardown:** Logging out immediately purges sensitive receipt modals and cancelled order details, redirecting to the shop section (`/#shop`).

---

### 🛵 Delivery Fleet (Riders) Portal (`/rider`)
- **Rider Authentication:** Secure mobile number (strictly 10 digits) and security PIN (strictly 6 digits) sign-in.
- **Strict Live Camera Delivery Proof:** Delivery riders must capture live photos directly through their device camera sensor upon handing over orders. Device gallery selection is strictly disabled to prevent spoofing.
- **Watermark & GPS Verification:** Camera captures automatically embed dynamic time, date, GPS coordinates, and watermarks into the image.
- **COD Cash Collection:** Immediate verification and status toggle for cash collected at the doorstep.

---

### 👑 Store Administration Suite (`/admin`)
- **Admin Authentication:** Protected login using 10-digit admin mobile / email and 6-digit security PIN.
- **Live Order Management:** Real-time order queue with status transitions: *Pending Confirmation → Confirmed → Preparing → Ready for Dispatch → Out for Delivery → Delivered → Cancelled*.
- **Admin Direct Delivery:** Option for store staff to mark orders delivered directly at the sweet shop using the same strict live-camera capture system.
- **Order Cancellation & UPI Refund Pipeline:** Cancel active orders with mandatory cancellation reasons. For paid UPI orders, an automated refund flow initiates, allowing admins to upload the bank transfer screenshot proof and enter the transaction reference (UTR) to notify the customer.
- **Emergency Store Shutoff & Temporary Closure:** Emergency controls to pause incoming orders or completely shut off the storefront, displaying festive reopening announcements.
- **Counter POS Terminal (`/admin/offline-sales`):** Rapid point-of-sale terminal for walk-in shop customers with automatic inventory deduction.
- **Inventory & Wastage Tracking (`/admin/inventory`):** Kitchen batch restock logging, wastage recording, low-stock threshold triggers, and inventory audit logs.
- **Operational Expense Logging (`/admin/expenses`):** Track procurement costs (milk, mawa, ghee, saffron, packaging) with category breakdowns.
- **Sales Analytics & CSV Export (`/admin/reports`):** Daily revenue breakdown, payment split (UPI vs COD vs Counter Cash), bestsellers, and one-click CSV report exports.
- **Rider Fleet Management (`/admin/riders`):** Add, activate, and manage delivery riders with phone number and PIN validation.
- **Coupon System (`/admin/coupons`):** Manage promotional discounts, first-time-customer restrictions, and usage limits.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Next.js 16 (App Router)](https://nextjs.org) with [Turbopack](https://turbo.build) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org) |
| **Database** | [Neon Serverless PostgreSQL](https://neon.tech) (`@neondatabase/serverless`) |
| **Authentication** | [Neon Auth](https://neon.tech/docs/guides/neon-auth) & BetterAuth |
| **Email Service** | SMTP Transport (Brevo / Nodemailer) for OTP verification |
| **Styling** | Vanilla CSS Tokens & Tailwind CSS |
| **Icons & Media** | [Lucide React](https://lucide.dev) |
| **Camera & Media** | HTML5 `getUserMedia` API with Canvas Watermarking |
| **Real-time Sync** | Server-Sent Events (SSE) Broadcast Stream |

---

## 🔒 Security Audit & Credentials Hygiene

- **No Hardcoded Secrets:** All database passwords, SMTP credentials, session secrets, and API tokens are loaded strictly from environment variables (`.env.local`).
- **Git Protection:** `.gitignore` excludes `.env*` files (while explicitly tracking `.env.example`), temporary scratch scripts (`scratch/`), uploaded media, and log files.
- **Role Isolation:** API routes validate customer, admin, and rider roles before performing privileged mutations.
- **Input Sanitization:** Strict 10-digit mobile validation and 6-digit PIN validation across all administrative and rider portals.
- **Tamper-Resistant Delivery Verification:** Live camera enforcement ensures delivery photos originate from the camera stream rather than pre-existing files on disk.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js:** v18.18.0 or later
- **npm:** v9.0.0 or later

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/mithaase.git
cd mithaase
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Update `.env.local` with your configuration:
- `DATABASE_URL`: Your Neon Serverless Postgres connection string.
- `NEON_AUTH_BASE_URL` & `NEON_AUTH_COOKIE_SECRET`: Your Neon Auth configuration.
- `SMTP_USER` & `SMTP_PASS`: Your SMTP credentials for email OTP delivery.
- `NEXT_PUBLIC_STORE_UPI_ID`: Your merchant UPI ID (e.g. `shreeshyam@upi`).

### 4. Database Setup & Migrations
The tables will auto-initialize or you can run migrations against your Neon Postgres instance:
```bash
# Verify connection
node scratch/check-admin.js
```

### 5. Running the Application Locally
Start the development server with Turbopack:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the storefront.

### 6. Production Build
Validate the build before deploying:
```bash
npm run build
npm start
```

---

## 📱 SMSGate Phone Verification Setup (Optional Profile SMS OTP)

Mithaasé supports optional phone number verification on user profiles via [SMSGate (SMS Gateway for Android)](https://sms-gate.app/), a free and open-source Android app running directly on your phone in Cloud Server mode.

### 1. Install & Configure SMSGate on Android
1. Download and install the latest SMSGate APK from [GitHub Releases](https://github.com/capcom6/android-sms-gateway/releases) or F-Droid / Google Play.
2. Grant standard SMS send and background battery optimization permissions.
3. In the SMSGate app settings, enable **Cloud Server** mode.
4. Copy your generated Cloud credentials:
   - **Username** (`SMSGATE_USER`)
   - **Password** (`SMSGATE_PASS`)

### 2. Configure Vercel / Environment Variables
Add the credentials and an HMAC secret to your environment variables (`.env.local` or Vercel Dashboard):
```env
SMSGATE_USER="your-smsgate-username"
SMSGATE_PASS="your-smsgate-password"
OTP_HMAC_SECRET="your-random-32-character-secret-key"
```

### 3. Verification Behavior & Security
- **Optional & Non-Blocking:** Verification never blocks user login, browsing, or checkout flows.
- **Rate-Limited in Database:** Max 3 OTP requests per 10 minutes per user, per phone, and per IP.
- **HMAC OTP Storage:** Clear-text OTPs are never stored; only an HMAC SHA-256 hash with `OTP_HMAC_SECRET` is saved in PostgreSQL with a 5-minute expiry.
- **Single Source of Truth:** If a user edits their phone number, `phone_verified` automatically resets to `false`.

---

## 📂 Key Directory Layout

```
├── app/
│   ├── admin/                # Admin operations (orders, products, inventory, pos, reports)
│   ├── api/                  # REST & SSE endpoints (orders, auth, inventory, events)
│   ├── auth/callback/        # Social OAuth callback handler
│   ├── checkout/             # Multi-step checkout with map pin & payment selection
│   ├── order-confirmation/   # Real-time live order tracking & receipt view
│   ├── orders/               # Customer orders portal & tax receipts
│   ├── rider/                # Delivery fleet dispatch portal & live camera proof
│   └── page.tsx              # Festive storefront home
├── components/
│   ├── admin/                # Admin navigation, quick order tracker, layout
│   ├── auth/                 # CustomerAuthPortal, CustomerAuthModal
│   ├── camera/               # LiveCameraCapture (strictly hardware camera only)
│   ├── checkout/             # Payment modal, QR generation
│   ├── maps/                 # Draggable MapLocationPicker with GPS detection
│   ├── orders/               # LiveOrderTracker, OrderReceipt
│   └── storefront/           # AnnouncementBar, Navbar, Footer, SweetOrbit, Diya
├── lib/
│   ├── auth/                 # Neon Auth client & session helpers
│   ├── context/              # user-auth-context, cart-context, store-context
│   ├── data/                 # Postgres store operations & initial seed data
│   ├── hooks/                # useRealtime SSE hook
│   └── utils/                # audio notifications & helpers
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore configuration
└── README.md                 # Project documentation
```

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for details.
