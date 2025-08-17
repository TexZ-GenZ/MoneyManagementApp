import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Company } from '../types/company';
import ApiService from '../services/api';

interface CompaniesState {
  companies: Company[];
  selectedCompany: Company | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: CompaniesState = {
  companies: [],
  selectedCompany: null,
  isLoading: false,
  error: null,
};

// Async thunks
export const fetchCompanies = createAsyncThunk(
  'companies/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const companies = await ApiService.getCompanies();
      return companies;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchExecutiveCompanies = createAsyncThunk(
  'companies/fetchExecutiveCompanies',
  async (executiveId: string, { rejectWithValue }) => {
    try {
      const companies = await ApiService.getExecutiveCompanies(executiveId);
      return companies;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchCompanyByCode = createAsyncThunk(
  'companies/fetchByCode',
  async (code: string, { rejectWithValue }) => {
    try {
      const company = await ApiService.getCompanyByCode(code);
      return company;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateCompany = createAsyncThunk(
  'companies/update',
  async ({ code, data }: { code: string; data: Partial<Company> }, { rejectWithValue }) => {
    try {
      const updatedCompany = await ApiService.updateCompany(code, data);
      return updatedCompany;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const companiesSlice = createSlice({
  name: 'companies',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setSelectedCompany: (state, action: PayloadAction<Company | null>) => {
      state.selectedCompany = action.payload;
    },
    updateCompanyPromiseDate: (state, action: PayloadAction<{ code: string; promiseDate: string }>) => {
      const { code, promiseDate } = action.payload;
      const company = state.companies.find(c => c.code === code);
      if (company) {
        company.promise_date = promiseDate;
        company.updated_at = new Date().toISOString();
      }
      if (state.selectedCompany && state.selectedCompany.code === code) {
        state.selectedCompany.promise_date = promiseDate;
        state.selectedCompany.updated_at = new Date().toISOString();
      }
    },
    updateCompanyAmounts: (state, action: PayloadAction<{ code: string; amount: string; outbal: string }>) => {
      const { code, amount, outbal } = action.payload;
      const company = state.companies.find(c => c.code === code);
      if (company) {
        company.amount = amount;
        company.outbal = outbal;
        company.updated_at = new Date().toISOString();
      }
      if (state.selectedCompany && state.selectedCompany.code === code) {
        state.selectedCompany.amount = amount;
        state.selectedCompany.outbal = outbal;
        state.selectedCompany.updated_at = new Date().toISOString();
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all companies
      .addCase(fetchCompanies.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCompanies.fulfilled, (state, action) => {
        state.isLoading = false;
        state.companies = action.payload;
        state.error = null;
      })
      .addCase(fetchCompanies.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch executive companies
      .addCase(fetchExecutiveCompanies.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchExecutiveCompanies.fulfilled, (state, action) => {
        state.isLoading = false;
        state.companies = action.payload;
        state.error = null;
      })
      .addCase(fetchExecutiveCompanies.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch company by code
      .addCase(fetchCompanyByCode.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCompanyByCode.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedCompany = action.payload;
        state.error = null;
      })
      .addCase(fetchCompanyByCode.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Update company
      .addCase(updateCompany.fulfilled, (state, action) => {
        const updatedCompany = action.payload;
        const index = state.companies.findIndex(c => c.code === updatedCompany.code);
        if (index !== -1) {
          state.companies[index] = updatedCompany;
        }
        if (state.selectedCompany && state.selectedCompany.code === updatedCompany.code) {
          state.selectedCompany = updatedCompany;
        }
      })
      .addCase(updateCompany.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  clearError,
  setSelectedCompany,
  updateCompanyPromiseDate,
  updateCompanyAmounts
} = companiesSlice.actions;

export default companiesSlice.reducer;
