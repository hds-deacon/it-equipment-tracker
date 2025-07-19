export interface Admin {
  id: number;
  email: string;
  name: string;
  created_at: string;
  last_login?: string;
  active: boolean;
}

export interface Employee {
  id: number;
  employee_id: string;
  email: string;
  first_name: string;
  last_name: string;
  department?: string;
  job_title?: string;
  phone?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EquipmentCategory {
  id: number;
  name: string;
  description?: string;
  created_at: string;
}

export interface EquipmentTag {
  id: number;
  name: string;
  color: string;
  description?: string;
  created_at: string;
}

export interface Equipment {
  id: number;
  asset_tag: string;
  category_id?: number;
  category_name?: string;
  manufacturer: string;
  make: string;
  model: string;
  serial_number: string;
  purchase_date?: string;
  purchase_cost?: number;
  job_code?: string;
  cost_code?: string;
  condition: 'New' | 'Good' | 'Fair' | 'Poor' | 'Damaged' | 'Retired';
  warranty_start_date?: string;
  warranty_end_date?: string;
  warranty_provider?: string;
  notes?: string;
  qr_code_generated: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
  tags?: string;
  status?: 'available' | 'checked_out';
  checked_out_to?: string;
  current_location?: string;
  due_date?: string;
}

export interface Bundle {
  id: number;
  name: string;
  description?: string;
  bundle_type?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  equipment_count?: number;
  status?: 'available' | 'checked_out';
  checked_out_to?: string;
  current_location?: string;
  due_date?: string;
}

export interface BundleContent {
  bundle_id: number;
  equipment_id: number;
  quantity: number;
  added_at: string;
  asset_tag?: string;
  manufacturer?: string;
  make?: string;
  model?: string;
  serial_number?: string;
  category_name?: string;
  equipment_status?: 'available' | 'checked_out';
}

export interface Transaction {
  id: number;
  equipment_id: number;
  employee_id: number;
  transaction_type: 'checkout' | 'checkin';
  location?: string;
  due_date?: string;
  returned_date?: string;
  condition_out?: string;
  condition_in?: string;
  notes?: string;
  processed_by: number;
  processed_at: string;
  asset_tag?: string;
  manufacturer?: string;
  make?: string;
  model?: string;
  serial_number?: string;
  category_name?: string;
  employee_name?: string;
  employee_email?: string;
  department?: string;
  processed_by_name?: string;
}

export interface EquipmentFile {
  id: number;
  equipment_id: number;
  file_name: string;
  file_path: string;
  file_type: 'warranty' | 'receipt' | 'manual' | 'photo' | 'certificate' | 'other';
  file_size: number;
  mime_type: string;
  uploaded_by: number;
  uploaded_at: string;
  uploaded_by_name?: string;
}

export interface ActivityLog {
  id: number;
  admin_id?: number;
  employee_id?: number;
  action: string;
  entity_type?: string;
  entity_id?: number;
  old_values?: string;
  new_values?: string;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
  admin_name?: string;
  employee_name?: string;
}

export interface ApiResponse<T> {
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface DashboardStats {
  statistics: {
    total_equipment: number;
    checked_out_equipment: number;
    available_equipment: number;
    overdue_equipment: number;
    total_employees: number;
    recent_transactions: number;
  };
  equipmentByCategory: Array<{
    category: string;
    count: number;
    checked_out: number;
  }>;
  recentActivity: Transaction[];
}

export interface ReportColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'datetime' | 'currency';
}

export interface ReportFilters {
  category?: string;
  condition?: string;
  status?: string;
  tags?: string[];
  search?: string;
  employee_id?: string;
  equipment_id?: string;
  start_date?: string;
  end_date?: string;
  transaction_type?: string;
  admin_id?: string;
  action?: string;
  entity_type?: string;
}