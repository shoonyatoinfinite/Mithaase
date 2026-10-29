import { createCoupon, getCouponByCode, updateCoupon, deleteCoupon, validateAndCalculateCoupon } from "../lib/data/store.ts";

async function test() {
  console.log("=== Testing Coupon with Both Discount and Free Delivery ===");

  const testCode1 = "TESTFLAT" + Math.floor(Math.random() * 10000);
  console.log(`\n1. Creating coupon ${testCode1} (flat_amount ₹50 OFF + FREE Delivery)...`);
  const createRes1 = await createCoupon({
    code: testCode1,
    description: "Flat ₹50 OFF plus Free Delivery on orders above ₹200",
    discount_type: "flat_amount",
    discount_value: 50,
    min_order_amount: 200,
    max_discount_amount: 50,
    free_delivery: true,
    is_active: true,
  });

  if (!createRes1.success || !createRes1.coupon) {
    console.error("FAILED to create coupon:", createRes1.error);
    process.exit(1);
  }
  console.log("✓ Coupon created successfully:", createRes1.coupon);

  const calc1 = await validateAndCalculateCoupon(testCode1, 350, 40, "test@example.com", "9999999999");
  console.log("✓ Calculation result:", calc1);
  if (!calc1.valid || calc1.discountAmount !== 50 || calc1.finalDeliveryCharge !== 0) {
    console.error("FAILED calculation check for flat_amount + free_delivery");
    process.exit(1);
  }
  console.log("✓ Correct calculation! Saved ₹50 and delivery fee is ₹0.");
  await deleteCoupon(createRes1.coupon.id);

  // Test 2: Percentage discount + Free Delivery
  const testCode2 = "TESTPCT" + Math.floor(Math.random() * 10000);
  console.log(`\n2. Creating coupon ${testCode2} (percentage 20% OFF (capped at ₹100) + FREE Delivery)...`);
  const createRes2 = await createCoupon({
    code: testCode2,
    description: "20% OFF plus Free Delivery on orders above ₹300",
    discount_type: "percentage",
    discount_value: 20,
    min_order_amount: 300,
    max_discount_amount: 100,
    free_delivery: true,
    is_active: true,
  });

  if (!createRes2.success || !createRes2.coupon) {
    console.error("FAILED to create percentage coupon:", createRes2.error);
    process.exit(1);
  }
  console.log("✓ Percentage Coupon created successfully:", createRes2.coupon);

  const calc2 = await validateAndCalculateCoupon(testCode2, 400, 40, "test@example.com", "9999999999");
  console.log("✓ Calculation result for ₹400 subtotal:", calc2);
  // 20% of 400 = 80. Delivery = 0.
  if (!calc2.valid || calc2.discountAmount !== 80 || calc2.finalDeliveryCharge !== 0) {
    console.error("FAILED calculation check for percentage + free_delivery");
    process.exit(1);
  }
  console.log("✓ Correct calculation! Saved ₹80 (20% of ₹400) and delivery fee is ₹0 (FREE Delivery).");
  await deleteCoupon(createRes2.coupon.id);

  console.log("\nALL TESTS PASSED CLEANLY!");
}

test().catch((err) => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});
