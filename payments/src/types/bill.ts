export interface Bill {
  id: string;
  bill: string; // Bill number (unique)
  code: string; // Company code (foreign key)
  date: string; // Bill date
  due_date: string; // Credit date
  debit: number; // Bill amount
  status: 'pending' | 'paid' | 'partial';
  paidAmount?: number;
  paymentDate?: string;
  paymentMethod?: string;
  executiveId?: string;
  accountantApproved?: boolean;
  adminApproved?: boolean;
  comments?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillSummary {
  totalBills: number;
  totalAmount: number;
  paidBills: number;
  paidAmount: number;
  pendingBills: number;
  pendingAmount: number;
  overdueBills: number;
  overdueAmount: number;
}
