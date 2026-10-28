/*
MITHAASÉ UPI LAUNCH TEST MATRIX (use ?upiexp=<name> on the checkout page, no redeploy needed)
Apps: GPay | PhonePe | Paytm | BHIM | Navi | Supermoney. Android and iOS separately.
  ?upiexp=default  generic upi://pay, am skipped for strict apps
  ?upiexp=amount   am included for all apps (control)
  ?upiexp=package  Android intent with scheme=upi + package
  ?upiexp=native   tez:// phonepe:// paytmmp://
  ?upiexp=mc0000   adds mc=0000
  Control: QR scan (camera + "Scan from gallery")
Reading results: no 'app_open_fallback' event after 'launch_clicked' = the app took over within 3s.
status='verified' on the payment = the payment really completed.
*/

-- 0. What happened in my last live tests?
SELECT e.created_at, o.order_ref, p.attempt_ref, e.event,
       e.payload->>'app' AS app, e.payload->>'exp' AS exp, e.payload->>'ua' AS ua, p.status
FROM payment_events e
JOIN payments p ON p.id = e.payment_id
JOIN orders o ON o.id = e.order_id
WHERE e.source = 'client'
ORDER BY e.created_at DESC
LIMIT 50;

-- 1. Full trail of one order
SELECT o.order_ref, p.attempt_no, p.attempt_ref, p.method, p.app_clicked, p.status,
       p.youpi_payment_id, p.upi_txn_ref, p.amount_expected, p.amount_received, p.verified_at
FROM orders o JOIN payments p ON p.order_id = o.id
WHERE o.order_ref = 'MTH-XXXXXXXX-XXXX'
ORDER BY p.attempt_no;

-- 2. Find order from a bank UTR / RRN
SELECT o.id AS order_id, o.order_ref, o.payment_status, p.attempt_ref, p.amount_received, p.verified_at
FROM payments p JOIN orders o ON o.id = p.order_id
WHERE p.upi_txn_ref = '<UTR>';

-- 3. Stuck payments older than 20 minutes
SELECT o.order_ref, p.*
FROM payments p JOIN orders o ON o.id = p.order_id
WHERE p.status IN ('launched','pending') AND p.created_at < now() - interval '20 minutes';

-- 4. Integrity check (MUST return 0 rows)
SELECT o.id, o.order_ref
FROM orders o
WHERE o.payment_status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'verified')
  AND o.created_at > '2026-10-28 00:00:00+00';  -- legacy orders have no payments row, so only check new ones

