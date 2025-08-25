export interface Company {
  code: string; // PRIMARY KEY
  account_n: string; // Company name
  area: string; // Executive name/area
  outbal: string; // Overdue amount (comes as string from backend)
  amount: string; // Total amount to be collected (comes as string from backend)
  // Deprecated: company-level promise_date no longer drives UI logic
  promise_date: string | null;
  credit_date: string | null; // Credit baseline (dashboard only)
  // New: earliest pending bill-level date (promise or dynamic due)
  next_due_date?: string | null;
  location: string | null; // Location
  phone: string | null; // Phone number
  email: string | null; // Email
  address: string | null; // Address
  assigned_executive_id: number | null; // Assigned executive ID
  last_collection_date: string | null; // Last collection date
  is_active: boolean; // Active status
  created_at: string; // Created timestamp
  updated_at: string | null; // Updated timestamp
  assigned_executive: any | null; // Assigned executive details
  total_pending: string; // Total pending amount (calculated)
  total_overdue: string; // Total overdue amount (calculated)
  bills_count: number; // Number of bills
}

export interface CompanyStats {
  totalPending: number;
  totalOverdue: number;
  billsCount: number;
  lastPaymentDate?: string;
}
