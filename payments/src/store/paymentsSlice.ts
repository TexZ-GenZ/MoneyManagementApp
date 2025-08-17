import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Payment, PaymentForm } from '../types/payment';
import ApiService from '../services/api';

interface PaymentsState {
  payments: Payment[];
  pendingApprovals: Payment[];
  executivePayments: Payment[];
  companyPaymentHistory: Payment[];
  recentPayment: Payment | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
}

const initialState: PaymentsState = {
  payments: [],
  pendingApprovals: [],
  executivePayments: [],
  companyPaymentHistory: [],
  recentPayment: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
};

// Async thunks
export const fetchPayments = createAsyncThunk(
  'payments/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const payments = await ApiService.getPayments();
      return payments;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchPendingPayments = createAsyncThunk(
  'payments/fetchPending',
  async (_, { rejectWithValue }) => {
    try {
      const payments = await ApiService.getPendingPayments();
      return payments;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchExecutivePayments = createAsyncThunk(
  'payments/fetchExecutivePayments',
  async (executiveId: string, { rejectWithValue }) => {
    try {
      const payments = await ApiService.getExecutivePayments(executiveId);
      return payments;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const submitPayment = createAsyncThunk(
  'payments/submit',
  async (paymentData: PaymentForm & { companyCode: string }, { rejectWithValue }) => {
    try {
      const payment = await ApiService.submitPayment(paymentData);
      return payment;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const createPayment = createAsyncThunk(
  'payments/create',
  async (paymentData: {
    company_code: string;
    bill_ids: number[];
    amount: number;
    payment_method: string;
    reference_number?: string;
    comments?: string;
  }, { rejectWithValue }) => {
    try {
      const payment = await ApiService.createPayment(paymentData);
      return payment;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const approvePayment = createAsyncThunk(
  'payments/approve',
  async ({ paymentId, approval }: { paymentId: string; approval: { approved: boolean; comments?: string } }, { rejectWithValue }) => {
    try {
      const payment = await ApiService.approvePayment(paymentId, approval);
      return payment;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const adminApprovePayment = createAsyncThunk(
  'payments/adminApprove',
  async ({ paymentId, approval }: { paymentId: string; approval: { approved: boolean; comments?: string } }, { rejectWithValue }) => {
    try {
      const payment = await ApiService.adminApprovePayment(paymentId, approval);
      return payment;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchCompanyPaymentHistory = createAsyncThunk(
  'payments/fetchCompanyHistory',
  async (companyCode: string, { rejectWithValue }) => {
    try {
      const payments = await ApiService.getCompanyPaymentHistory(companyCode);
      return payments;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchCompanyRecentPayment = createAsyncThunk(
  'payments/fetchCompanyRecent',
  async (companyCode: string, { rejectWithValue }) => {
    try {
      const payment = await ApiService.getCompanyRecentPayment(companyCode);
      return payment;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const paymentsSlice = createSlice({
  name: 'payments',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updatePaymentStatus: (state, action: PayloadAction<{ paymentId: string; status: Payment['status'] }>) => {
      const { paymentId, status } = action.payload;
      const paymentIdNum = parseInt(paymentId);

      // Update in all payments array
      const paymentIndex = state.payments.findIndex(p => p.id === paymentIdNum);
      if (paymentIndex !== -1) {
        state.payments[paymentIndex].status = status;
        state.payments[paymentIndex].updated_at = new Date().toISOString();
      }

      // Update in pending approvals array
      const pendingIndex = state.pendingApprovals.findIndex(p => p.id === paymentIdNum);
      if (pendingIndex !== -1) {
        if (status === 'completed' || status === 'failed') {
          // Remove from pending approvals when payment is completed or failed
          state.pendingApprovals.splice(pendingIndex, 1);
        } else {
          state.pendingApprovals[pendingIndex].status = status;
          state.pendingApprovals[pendingIndex].updated_at = new Date().toISOString();
        }
      }

      // Update in executive payments array
      const executiveIndex = state.executivePayments.findIndex(p => p.id === paymentIdNum);
      if (executiveIndex !== -1) {
        state.executivePayments[executiveIndex].status = status;
        state.executivePayments[executiveIndex].updated_at = new Date().toISOString();
      }
    },
    addPaymentApproval: (state, action: PayloadAction<{ paymentId: string; approval: any; type: 'accountant' | 'admin' }>) => {
      const { paymentId, approval, type } = action.payload;
      const paymentIdNum = parseInt(paymentId);

      const updatePayment = (payment: Payment) => {
        if (type === 'accountant') {
          // Update accountant approval fields
          payment.accountant_approved = approval.approved;
          payment.accountant_comments = approval.comments || null;
          payment.accountant_approved_at = new Date().toISOString();
        } else {
          // Update admin approval fields
          payment.admin_approved = approval.approved;
          payment.admin_comments = approval.comments || null;
          payment.admin_approved_at = new Date().toISOString();
        }
        payment.updated_at = new Date().toISOString();
      };

      // Update in all arrays
      const paymentIndex = state.payments.findIndex(p => p.id === paymentIdNum);
      if (paymentIndex !== -1) {
        updatePayment(state.payments[paymentIndex]);
      }

      const pendingIndex = state.pendingApprovals.findIndex(p => p.id === paymentIdNum);
      if (pendingIndex !== -1) {
        updatePayment(state.pendingApprovals[pendingIndex]);
      }

      const executiveIndex = state.executivePayments.findIndex(p => p.id === paymentIdNum);
      if (executiveIndex !== -1) {
        updatePayment(state.executivePayments[executiveIndex]);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all payments
      .addCase(fetchPayments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPayments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.payments = action.payload;
        state.error = null;
      })
      .addCase(fetchPayments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch pending payments
      .addCase(fetchPendingPayments.fulfilled, (state, action) => {
        state.pendingApprovals = action.payload;
      })
      // Fetch executive payments
      .addCase(fetchExecutivePayments.fulfilled, (state, action) => {
        state.executivePayments = action.payload;
      })
      // Submit payment
      .addCase(submitPayment.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(submitPayment.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.payments.push(action.payload);
        state.executivePayments.push(action.payload);
        state.error = null;
      })
      .addCase(submitPayment.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload as string;
      })
      // Create payment
      .addCase(createPayment.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(createPayment.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.payments.push(action.payload);
        state.executivePayments.push(action.payload);
        state.error = null;
      })
      .addCase(createPayment.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload as string;
      })
      // Approve payment (accountant)
      .addCase(approvePayment.fulfilled, (state, action) => {
        const updatedPayment = action.payload;

        // Update in all arrays
        const paymentIndex = state.payments.findIndex(p => p.id === updatedPayment.id);
        if (paymentIndex !== -1) {
          state.payments[paymentIndex] = updatedPayment;
        }

        const pendingIndex = state.pendingApprovals.findIndex(p => p.id === updatedPayment.id);
        if (pendingIndex !== -1) {
          state.pendingApprovals[pendingIndex] = updatedPayment;
        }

        const executiveIndex = state.executivePayments.findIndex(p => p.id === updatedPayment.id);
        if (executiveIndex !== -1) {
          state.executivePayments[executiveIndex] = updatedPayment;
        }
      })
      .addCase(approvePayment.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // Admin approve payment
      .addCase(adminApprovePayment.fulfilled, (state, action) => {
        const updatedPayment = action.payload;

        // Update in all arrays
        const paymentIndex = state.payments.findIndex(p => p.id === updatedPayment.id);
        if (paymentIndex !== -1) {
          state.payments[paymentIndex] = updatedPayment;
        }

        // Remove from pending approvals if final decision is made
        const pendingIndex = state.pendingApprovals.findIndex(p => p.id === updatedPayment.id);
        if (pendingIndex !== -1) {
          if (updatedPayment.status === 'completed' || updatedPayment.status === 'failed') {
            state.pendingApprovals.splice(pendingIndex, 1);
          } else {
            state.pendingApprovals[pendingIndex] = updatedPayment;
          }
        }

        const executiveIndex = state.executivePayments.findIndex(p => p.id === updatedPayment.id);
        if (executiveIndex !== -1) {
          state.executivePayments[executiveIndex] = updatedPayment;
        }
      })
      .addCase(adminApprovePayment.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // Fetch company payment history
      .addCase(fetchCompanyPaymentHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCompanyPaymentHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.companyPaymentHistory = action.payload;
      })
      .addCase(fetchCompanyPaymentHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch company recent payment
      .addCase(fetchCompanyRecentPayment.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCompanyRecentPayment.fulfilled, (state, action) => {
        state.isLoading = false;
        state.recentPayment = action.payload;
      })
      .addCase(fetchCompanyRecentPayment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.recentPayment = null;
      });
  },
});

export const {
  clearError,
  updatePaymentStatus,
  addPaymentApproval
} = paymentsSlice.actions;

export default paymentsSlice.reducer;
