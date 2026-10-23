import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

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

async function seed() {
  console.log("Checking Neon database seed state...");

  const existingProds = await sql.query("SELECT count(*) as count FROM products;");
  if (parseInt(existingProds[0].count) > 0) {
    console.log(`Database already contains ${existingProds[0].count} products. Skipping initial seed.`);
    return;
  }

  console.log("Seeding initial store data into Neon Postgres...");

  // 1. Categories
  const categories = [
    { name: "Barfi", slug: "barfi", description: "Rich, melt-in-the-mouth silver-foiled cashew and milk delicacies", display_order: 1 },
    { name: "Gulab Jamun", slug: "gulab-jamun", description: "Golden fried milk solids soaked in fragrant saffron-cardamom syrup", display_order: 2 },
    { name: "Kalakand", slug: "kalakand", description: "Authentic Alwar-style granular milk cake prepared in pure desi ghee", display_order: 3 },
    { name: "Rasgulla", slug: "rasgulla", description: "Classic soft and spongy cottage cheese dumplings in light sugar syrup", display_order: 4 },
    { name: "Rajbhog", slug: "rajbhog", description: "Royal saffron-infused oversized rasgulla stuffed with dry fruits and pistachios", display_order: 5 },
    { name: "Chamcham", slug: "chamcham", description: "Traditional festive cylindrical confection topped with malai and shredded coconut", display_order: 6 },
    { name: "Diwali Specials", slug: "diwali-specials", description: "Curated festival hampers, luxury gift boxes, and celebration platters", display_order: 7 },
    { name: "Special Food Items", slug: "special-food-items", description: "Hot, freshly made festive savory items including Diwali-day special Paneer Sabji", display_order: 8 }
  ];

  const catMap = {};
  for (const cat of categories) {
    const res = await sql.query(
      "INSERT INTO categories (name, slug, description, display_order) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO UPDATE SET display_order = $4 RETURNING id, slug;",
      [cat.name, cat.slug, cat.description, cat.display_order]
    );
    catMap[cat.slug] = res[0].id;
  }
  console.log(`✓ Seeded ${categories.length} categories`);

  // 2. Products and Variants
  const products = [
    {
      name: "Shahi Kaju Katli (Silver Vark)",
      slug: "shahi-kaju-katli",
      description: "Premium cashew fudge crafted with 100% pure Goan cashews and finished with genuine edible silver vark. Silky smooth texture with subtle cardamom aroma.",
      categorySlug: "barfi",
      image_url: "/images/kaju_katli.jpg",
      is_featured: true,
      badge: "Bestseller",
      variants: [
        { name: "250g", unit: "Box", price: 280, stock: 45 },
        { name: "500g", unit: "Box", price: 540, stock: 35 },
        { name: "1 kg", unit: "Box", price: 1050, stock: 20 },
      ]
    },
    {
      name: "Desi Ghee Gulab Jamun",
      slug: "desi-ghee-gulab-jamun",
      description: "Deep golden spheres made with fresh mawa and fried in pure desi ghee, dipped in hot saffron cardamom syrup with Iranian rose petals and pistachio slivers.",
      categorySlug: "gulab-jamun",
      image_url: "/images/gulab_jamun.jpg",
      is_featured: true,
      badge: "Festival Favorite",
      variants: [
        { name: "500g (Approx 8 pcs)", unit: "Pack", price: 240, stock: 50 },
        { name: "1 kg (Approx 16 pcs)", unit: "Pack", price: 460, stock: 30 },
      ]
    },
    {
      name: "Alwar Special Malai Kalakand",
      slug: "alwar-special-malai-kalakand",
      description: "Authentic granular milk cake made with slow-cooked whole cow milk, cardamom, and topped with generous sliced California pistachios and almonds.",
      categorySlug: "kalakand",
      image_url: "/images/kalakand.jpg",
      is_featured: true,
      badge: "House Specialty",
      variants: [
        { name: "500g", unit: "Box", price: 270, stock: 40 },
        { name: "1 kg", unit: "Box", price: 520, stock: 25 },
      ]
    },
    {
      name: "Royal Kesar Rajbhog (Dry Fruit Stuffed)",
      slug: "royal-kesar-rajbhog",
      description: "Grand yellow cottage cheese spheres infused with Kashmiri saffron, stuffed with mawa, roasted pistachios, and green cardamom, soaked in saffron syrup.",
      categorySlug: "rajbhog",
      image_url: "/images/rajbhog.jpg",
      is_featured: false,
      badge: "Royal Delicacy",
      variants: [
        { name: "4 Pieces", unit: "Matka Box", price: 200, stock: 35 },
        { name: "8 Pieces", unit: "Matka Box", price: 380, stock: 20 },
      ]
    },
    {
      name: "Diwali Maha Laxmi Sweets Hamper",
      slug: "diwali-maha-laxmi-sweets-hamper",
      description: "Festive presentation box containing Kaju Katli (250g), Desi Ghee Gulab Jamun (250g), Malai Kalakand (250g), and Assorted Roasted Dry Fruits (150g). Includes 2 brass diyas.",
      categorySlug: "diwali-specials",
      image_url: "/images/diwali_hamper.jpg",
      is_featured: true,
      badge: "Limited Edition",
      variants: [
        { name: "Grand Box (900g Total)", unit: "Gift Box", price: 1199, stock: 30 },
      ]
    },
    {
      name: "Diwali Day Special Shahi Paneer Sabji",
      slug: "diwali-day-special-shahi-paneer-sabji",
      description: "Freshly made in pure desi ghee and rich tomato-cashew gravy with farm-fresh malai paneer cubes, roasted kasuri methi, and whole spices.",
      categorySlug: "special-food-items",
      image_url: "/images/paneer_sabji.jpg",
      is_featured: true,
      badge: "Diwali Feast Only",
      variants: [
        { name: "Half Handi (500ml)", unit: "Handi", price: 220, stock: 50 },
        { name: "Family Handi (1L / 1000ml)", unit: "Handi", price: 420, stock: 50 },
      ]
    }
  ];

  for (const prod of products) {
    const catId = catMap[prod.categorySlug];
    if (!catId) continue;

    const res = await sql.query(
      `INSERT INTO products (name, slug, description, category_id, image_url, is_featured, badge)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE SET name = $1 RETURNING id;`,
      [prod.name, prod.slug, prod.description, catId, prod.image_url, prod.is_featured, prod.badge]
    );
    const prodId = res[0].id;

    for (const v of prod.variants) {
      await sql.query(
        `INSERT INTO product_variants (product_id, variant_name, unit, price, stock_quantity)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (product_id, variant_name) DO UPDATE SET price = $4, stock_quantity = $5;`,
        [prodId, v.name, v.unit, v.price, v.stock]
      );
    }
  }

  // 3. Coupons
  await sql.query(`
    INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, is_active)
    VALUES 
      ('DIWALI50', 'Flat ₹50 OFF on orders above ₹499', 'flat_amount', 50, 499, true),
      ('FREEDEL', 'Free Delivery on all festive orders', 'free_delivery', 21, 0, true),
      ('FESTIVE10', '10% OFF on all sweets orders', 'percentage', 10, 399, true)
    ON CONFLICT (code) DO NOTHING;
  `);

  console.log("✓ Successfully seeded products, variants, and coupons into Neon Postgres!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
