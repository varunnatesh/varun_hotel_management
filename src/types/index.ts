// ─── User & Auth ──────────────────────────────────────────────────────────────
export type UserRole =
  | 'owner'
  | 'store_manager'
  | 'kitchen'
  | 'supervisor'
  | 'cashier'
  | 'captain'
  | 'guest';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  branch_id?: string;
  is_active: boolean;
  avatar_url?: string;
  created_at: string;
  last_login?: string;
}

// ─── Branch ───────────────────────────────────────────────────────────────────
export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  is_active: boolean;
  created_at: string;
}

// ─── Menu ─────────────────────────────────────────────────────────────────────
export type MenuCategory =
  | 'starters'
  | 'main_course'
  | 'breads'
  | 'rice_biryani'
  | 'beverages'
  | 'desserts'
  | 'soups'
  | 'salads';

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  description?: string;
  is_available_today: boolean;
  image_url?: string;
  created_by: string;
  branch_id: string;
  created_at: string;
  // Computed
  material_cost?: number;
  profit_per_plate?: number;
  profit_margin?: number;
}

// ─── Materials / Inventory ────────────────────────────────────────────────────
export type MaterialUnit = 'kg' | 'litre' | 'ml' | 'grams' | 'pcs' | 'packet';

export interface Material {
  id: string;
  name: string;
  unit: MaterialUnit;
  current_stock: number;
  min_stock_level: number;
  avg_daily_usage: number;
  cost_per_unit: number;
  branch_id: string;
  // Computed
  days_remaining?: number;
  stock_status?: 'critical' | 'low' | 'healthy';
  recommended_buy?: number;
}

export interface MaterialPurchase {
  id: string;
  material_id: string;
  material?: Material;
  quantity: number;
  cost_per_unit: number;
  total_cost: number;
  supplier_name: string;
  bill_number?: string;
  purchased_by: string;
  approved_by?: string;
  date: string;
  status: 'pending_approval' | 'approved' | 'rejected';
}

export interface MaterialIssue {
  id: string;
  material_id: string;
  material?: Material;
  quantity: number;
  issued_by: string;
  received_by?: string;
  confirmed: boolean;
  date: string;
  notes?: string;
}

export interface DishMaterial {
  id: string;
  menu_item_id: string;
  material_id: string;
  material?: Material;
  quantity_per_serving: number;
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'billed'
  | 'cancelled';

export type OrderSource = 'cashier' | 'qr_table' | 'room_service';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'pending';

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_item?: MenuItem;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Order {
  id: string;
  table_no?: string;
  room_no?: string;
  order_source: OrderSource;
  status: OrderStatus;
  cashier_id?: string;
  cashier?: Pick<User, 'id' | 'name'>;
  total_amount: number;
  created_at: string;
  updated_at: string;
  branch_id: string;
  items?: OrderItem[];
  payment?: Payment;
  discount?: Discount;
  // Computed
  elapsed_minutes?: number;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  method: PaymentMethod;
  collected_by: string;
  timestamp: string;
  reference_no?: string;
}

export interface Discount {
  id: string;
  order_id: string;
  amount: number;
  reason: string;
  requested_by: string;
  approved_by?: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
export type ExpenseCategory =
  | 'electricity'
  | 'lpg_gas'
  | 'salary'
  | 'rent'
  | 'maintenance'
  | 'water'
  | 'other';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: string;
  added_by: string;
  branch_id: string;
}

// ─── Waste Logs ───────────────────────────────────────────────────────────────
export interface WasteLog {
  id: string;
  material_id: string;
  material?: Material;
  quantity: number;
  reason: string;
  logged_by: string;
  date: string;
  estimated_cost?: number;
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
export type AlertType =
  | 'unusual_usage'
  | 'unbilled_order'
  | 'price_tampering'
  | 'large_discount'
  | 'low_stock'
  | 'critical_stock'
  | 'purchase_approval'
  | 'system';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  severity: AlertSeverity;
  is_seen: boolean;
  created_at: string;
  resolved_at?: string;
  branch_id: string;
  metadata?: Record<string, unknown>;
}

// ─── Staff Logs / Audit ───────────────────────────────────────────────────────
export interface StaffLog {
  id: string;
  user_id: string;
  user?: Pick<User, 'id' | 'name' | 'role'>;
  action: string;
  table_affected: string;
  record_id?: string;
  details: string;
  ip_address?: string;
  timestamp: string;
}

// ─── Approval Requests ────────────────────────────────────────────────────────
export type ApprovalType =
  | 'material_purchase'
  | 'price_change'
  | 'large_discount'
  | 'order_cancellation'
  | 'new_menu_item';

export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  requested_by: string;
  requester?: Pick<User, 'id' | 'name' | 'role'>;
  details: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  created_at: string;
  resolved_at?: string;
  branch_id: string;
}

// ─── Daily Summary ────────────────────────────────────────────────────────────
export interface DailySummary {
  id: string;
  date: string;
  total_orders: number;
  total_revenue: number;
  material_cost: number;
  other_expenses: number;
  net_profit: number;
  profit_margin: number;
  branch_id: string;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export interface DashboardStats {
  today_revenue: number;
  today_orders: number;
  today_profit: number;
  active_orders: number;
  staff_online: number;
  low_stock_count: number;
  pending_approvals: number;
  health_score: number;
  // Trends (vs yesterday)
  revenue_trend: number;
  orders_trend: number;
  profit_trend: number;
}

export interface HealthScoreBreakdown {
  revenue: number;
  stock: number;
  kitchen: number;
  fraud: number;
  wastage: number;
  staff: number;
  total: number;
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

// ─── Charts ───────────────────────────────────────────────────────────────────
export interface ChartDataPoint {
  date: string;
  label: string;
  revenue: number;
  profit: number;
  orders: number;
}

export interface DishPerformance {
  id: string;
  name: string;
  category: MenuCategory;
  total_orders: number;
  total_revenue: number;
  profit_per_plate: number;
  profit_margin: number;
  rank: number;
}

// ─── Utility Types ────────────────────────────────────────────────────────────
export type TimeRange = '7d' | '30d' | '90d' | 'custom';

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
