export type OrderStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_dispatch'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'pending_verification'
  | 'paid'
  | 'failed'
  | 'refunded';

export type RefundStatus = 'pending' | 'in_process' | 'refunded' | 'failed';

export type PaymentMethod = 'cod' | 'upi' | 'cash';

export type StoreStatus = 'open' | 'paused' | 'closed' | 'shutoff';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  display_order: number;
  is_active: boolean;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string; // e.g., '250g', '500g', '1kg', '1 Box', '1 Portion'
  unit: string;
  price: number;
  stock_quantity: number;
  reserved_quantity?: number;
  low_stock_threshold: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category_id: string;
  category_name?: string;
  image_url: string;
  is_active: boolean;
  is_featured: boolean;
  badge?: string; // e.g., 'Bestseller', 'Diwali Special', 'Festive Favorite'
  variants: ProductVariant[];
  // For special seasonal rules (e.g. Paneer Sabji)
  is_seasonal_special?: boolean;
  special_start_date?: string;
  special_end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  unit: string;
  price: number;
  quantity: number;
  imageUrl: string;
  maxStock: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  product_name_snapshot: string;
  variant_name_snapshot: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  image_url?: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  previous_status: OrderStatus;
  new_status: OrderStatus;
  changed_by: string;
  note?: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  delivery_address: string;
  locality: string;
  landmark?: string;
  delivery_instructions?: string;
  subtotal: number;
  discount_amount: number;
  delivery_charge: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  upi_reference?: string;
  upi_screenshot?: string;
  latitude?: number;
  longitude?: number;
  map_url?: string;
  coupon_code?: string;
  pickup_photo?: string;
  delivery_proof_photo?: string;
  delivered_at?: string;
  delivered_lat?: number;
  delivered_lng?: number;
  delivered_location_name?: string;
  delivered_map_url?: string;
  delivery_queued?: boolean;
  delivery_group_id?: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  refund_status?: RefundStatus;
  refund_amount?: number;
  refund_txn_id?: string;
  refund_screenshot?: string;
  refunded_at?: string;
  source: 'online' | 'manual';
  booking_status?: 'standard' | 'requested' | 'approved_for_payment' | 'payment_selected' | 'confirmed';
  items: OrderItem[];
  status_history?: OrderStatusHistory[];
  created_at: string;
  updated_at: string;
}

export type CouponDiscountType = 'flat_amount' | 'percentage' | 'free_delivery';

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discount_type: CouponDiscountType;
  discount_value: number; // Flat Rs, percentage %, or delivery fee amount
  min_order_amount: number;
  max_discount_amount?: number; // Cap for percentage discounts
  free_delivery?: boolean; // When true, waives the delivery fee
  usage_count?: number;
  is_active: boolean;
  created_at: string;
}

export interface OfflineSaleItem {
  id: string;
  offline_sale_id: string;
  product_id: string;
  variant_id: string;
  product_name_snapshot: string;
  variant_name_snapshot: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface OfflineSale {
  id: string;
  sale_number: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  customer_name?: string;
  customer_phone?: string;
  items: OfflineSaleItem[];
  created_by: string;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  movement_type: 'addition' | 'reduction' | 'correction' | 'wastage' | 'order_reservation' | 'order_cancellation' | 'sale';
  quantity_change: number; // positive or negative
  stock_after: number;
  reason: string;
  related_order_id?: string;
  related_sale_id?: string;
  created_by: string;
  created_at: string;
}

export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  payment_method: 'cash' | 'upi';
  expense_date: string;
  description?: string;
  receipt_url?: string;
  created_by: string;
  created_at: string;
}

export interface StoreSettings {
  store_name: string;
  brand_tagline: string;
  store_status: StoreStatus;
  accepts_orders: boolean;
  default_delivery_fee: number;
  minimum_order_value: number;
  same_day_delivery_enabled: boolean;
  operating_hours: string;
  cutoff_time: string;
  service_areas: string[]; // e.g. ["Main Market", "Shyam Nagar", "Ram Mandir Ward", "Station Road", "Civil Lines", "Green Park"]
  business_phone: string;
  whatsapp_number: string;
  shop_address: string;
  announcement_message: string;
  closure_message: string;
  store_shutoff?: boolean;
  shutoff_message?: string;
  upi_id: string; // e.g. "shreeshyam@upi"
  upi_payee_name: string;
  admin_name?: string;
  admin_email?: string;
  admin_phone?: string;
  admin_pin?: string;
}

export interface CustomerAccount {
  id: string;
  email: string;
  phone: string;
  password?: string;
  pin: string; // 6-digit security PIN
  name: string;
  delivery_address: string;
  locality: string;
  landmark?: string;
  delivery_instructions?: string;
  latitude: number;
  longitude: number;
  map_url: string;
  created_at: string;
  updated_at: string;
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  email?: string;
  pin: string;
  vehicle_type?: string;
  vehicle_number?: string;
  assigned_area?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminProfile {
  name: string;
  email: string;
  phone: string;
  pin: string;
  role: 'super_admin' | 'manager' | 'staff';
}

