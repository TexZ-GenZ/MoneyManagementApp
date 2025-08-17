export interface Payment {
  id: string;
  billIds: string[]; // Array of bill IDs being paid
  companyCode: string;
  companyName: string;
  executiveId: string;
  executiveName: string;
  amountCollected: number;
  paymentDate: string;
  nextPromiseDate: string;
  paymentMethod: 'cash' | 'cheque' | 'online' | 'card';
  location: {
    latitude: number;
    longitude: number;
    address: string;
    verified: boolean;
  };
  comments?: string;
  status: 'submitted' | 'accountant_approved' | 'accountant_declined' | 'admin_approved' | 'admin_declined';
  accountantApproval?: {
    approvedBy: string;
    approvedAt: string;
    comments?: string;
  };
  adminApproval?: {
    approvedBy: string;
    approvedAt: string;
    comments?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PaymentForm {
  billIds: string[];
  amountCollected: number;
  nextPromiseDate: string;
  paymentMethod: 'cash' | 'cheque' | 'online' | 'card';
  locationVerified: boolean;
  comments?: string;
}

export interface PaymentStats {
  todayCollections: number;
  weeklyCollections: number;
  monthlyCollections: number;
  pendingApprovals: number;
}
