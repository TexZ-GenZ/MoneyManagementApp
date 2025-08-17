import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Bill } from '../types/bill';
import ApiService from '../services/api';

interface BillsState {
  bills: Bill[];
  companyBills: Bill[];
  pendingBills: Bill[];
  paidBills: Bill[];
  selectedBills: number[];
  isLoading: boolean;
  error: string | null;
}

const initialState: BillsState = {
  bills: [],
  companyBills: [],
  pendingBills: [],
  paidBills: [],
  selectedBills: [],
  isLoading: false,
  error: null,
};

// Async thunks
export const fetchBills = createAsyncThunk(
  'bills/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const bills = await ApiService.getBills();
      return bills;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchCompanyBills = createAsyncThunk(
  'bills/fetchCompanyBills',
  async (companyCode: string, { rejectWithValue }) => {
    try {
      const bills = await ApiService.getCompanyBills(companyCode);
      return bills;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchPendingBills = createAsyncThunk(
  'bills/fetchPending',
  async (_, { rejectWithValue }) => {
    try {
      const bills = await ApiService.getPendingBills();
      return bills;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchPaidBills = createAsyncThunk(
  'bills/fetchPaid',
  async (_, { rejectWithValue }) => {
    try {
      const bills = await ApiService.getPaidBills();
      return bills;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateBill = createAsyncThunk(
  'bills/update',
  async ({ id, data }: { id: string; data: Partial<Bill> }, { rejectWithValue }) => {
    try {
      const updatedBill = await ApiService.updateBill(id, data);
      return updatedBill;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const billsSlice = createSlice({
  name: 'bills',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    toggleBillSelection: (state, action: PayloadAction<number>) => {
      const billId = action.payload;
      const index = state.selectedBills.indexOf(billId);
      if (index !== -1) {
        state.selectedBills.splice(index, 1);
      } else {
        state.selectedBills.push(billId);
      }
    },
    clearBillSelection: (state) => {
      state.selectedBills = [];
    },
    selectAllBills: (state, action: PayloadAction<number[]>) => {
      state.selectedBills = action.payload;
    },
    updateBillStatus: (state, action: PayloadAction<{ billId: number; status: 'pending' | 'paid' | 'partial'; paidAmount?: number }>) => {
      const { billId, status, paidAmount } = action.payload;

      // Update in all bills array
      const billIndex = state.bills.findIndex(b => b.id === billId);
      if (billIndex !== -1) {
        state.bills[billIndex].status = status;
        if (paidAmount !== undefined) {
          state.bills[billIndex].paidAmount = paidAmount;
        }
        state.bills[billIndex].updatedAt = new Date().toISOString();
      }

      // Update in company bills array
      const companyBillIndex = state.companyBills.findIndex(b => b.id === billId);
      if (companyBillIndex !== -1) {
        state.companyBills[companyBillIndex].status = status;
        if (paidAmount !== undefined) {
          state.companyBills[companyBillIndex].paidAmount = paidAmount;
        }
        state.companyBills[companyBillIndex].updatedAt = new Date().toISOString();
      }
    },
    markBillsAsPaid: (state, action: PayloadAction<{ billIds: number[]; paymentDate: string; paymentMethod: string }>) => {
      const { billIds, paymentDate, paymentMethod } = action.payload;

      billIds.forEach(billId => {
        // Update in all bills array
        const billIndex = state.bills.findIndex(b => b.id === billId);
        if (billIndex !== -1) {
          state.bills[billIndex].status = 'paid';
          state.bills[billIndex].paymentDate = paymentDate;
          state.bills[billIndex].paymentMethod = paymentMethod;
          state.bills[billIndex].updatedAt = new Date().toISOString();
        }

        // Update in company bills array
        const companyBillIndex = state.companyBills.findIndex(b => b.id === billId);
        if (companyBillIndex !== -1) {
          state.companyBills[companyBillIndex].status = 'paid';
          state.companyBills[companyBillIndex].paymentDate = paymentDate;
          state.companyBills[companyBillIndex].paymentMethod = paymentMethod;
          state.companyBills[companyBillIndex].updatedAt = new Date().toISOString();
        }
      });

      // Clear selection
      state.selectedBills = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all bills
      .addCase(fetchBills.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBills.fulfilled, (state, action) => {
        state.isLoading = false;
        state.bills = action.payload;
        state.error = null;
      })
      .addCase(fetchBills.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch company bills
      .addCase(fetchCompanyBills.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCompanyBills.fulfilled, (state, action) => {
        state.isLoading = false;
        state.companyBills = action.payload;
        state.error = null;
      })
      .addCase(fetchCompanyBills.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch pending bills
      .addCase(fetchPendingBills.fulfilled, (state, action) => {
        state.pendingBills = action.payload;
      })
      // Fetch paid bills
      .addCase(fetchPaidBills.fulfilled, (state, action) => {
        state.paidBills = action.payload;
      })
      // Update bill
      .addCase(updateBill.fulfilled, (state, action) => {
        const updatedBill = action.payload;

        // Update in all bills array
        const billIndex = state.bills.findIndex(b => b.id === updatedBill.id);
        if (billIndex !== -1) {
          state.bills[billIndex] = updatedBill;
        }

        // Update in company bills array
        const companyBillIndex = state.companyBills.findIndex(b => b.id === updatedBill.id);
        if (companyBillIndex !== -1) {
          state.companyBills[companyBillIndex] = updatedBill;
        }
      })
      .addCase(updateBill.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  clearError,
  toggleBillSelection,
  clearBillSelection,
  selectAllBills,
  updateBillStatus,
  markBillsAsPaid
} = billsSlice.actions;

export default billsSlice.reducer;
