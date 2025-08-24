import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { StorageService } from '../services/storageService';

export interface SettingsState {
  creditExtensionDays: number | null;
  notifEveryHours: number | null;
  execWindowStartHour: number | null;
  execWindowEndHour: number | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: SettingsState = {
  creditExtensionDays: null,
  notifEveryHours: null,
  execWindowStartHour: null,
  execWindowEndHour: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
};

const API_BASE = process.env.APP_URI || process.env.EXPO_PUBLIC_APP_URI;

export const fetchSettings = createAsyncThunk('settings/fetch', async () => {
  const tok = await StorageService.getToken();
  const r = await fetch(`${API_BASE}/settings`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok?.access_token}` } });
  if (!r.ok) throw new Error('Failed to load settings');
  return await r.json();
});

export const updateCreditExtensionDays = createAsyncThunk(
  'settings/updateCreditExtensionDays',
  async (days: number, { rejectWithValue }) => {
    try {
      const tok = await StorageService.getToken();
      const r = await fetch(`${API_BASE}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok?.access_token}` },
        body: JSON.stringify({ credit_extension_days: days }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || 'Update failed');
      return data;
    } catch (e: any) {
      return rejectWithValue(e.message || 'Update failed');
    }
  }
);

// Generic partial settings update supporting all exposed fields
export const updateSettings = createAsyncThunk(
  'settings/updateSettings',
  async (payload: { credit_extension_days?: number; notif_every_hours?: number; exec_window_start_hour?: number; exec_window_end_hour?: number }, { rejectWithValue }) => {
    try {
      const tok = await StorageService.getToken();
      const r = await fetch(`${API_BASE}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok?.access_token}` },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || 'Update failed');
      return data;
    } catch (e: any) {
      return rejectWithValue(e.message || 'Update failed');
    }
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(fetchSettings.fulfilled, (s, a: PayloadAction<any>) => {
        s.isLoading = false;
        s.creditExtensionDays = a.payload.credit_extension_days ?? s.creditExtensionDays;
        s.notifEveryHours = a.payload.notif_every_hours ?? s.notifEveryHours;
        s.execWindowStartHour = a.payload.exec_window_start_hour ?? s.execWindowStartHour;
        s.execWindowEndHour = a.payload.exec_window_end_hour ?? s.execWindowEndHour;
        s.lastUpdated = Date.now();
      })
      .addCase(fetchSettings.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string || 'Failed'; })
      .addCase(updateCreditExtensionDays.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(updateCreditExtensionDays.fulfilled, (s, a: PayloadAction<any>) => {
        s.isLoading = false;
        s.creditExtensionDays = a.payload.credit_extension_days;
        s.notifEveryHours = a.payload.notif_every_hours ?? s.notifEveryHours; // backend returns full object
        s.execWindowStartHour = a.payload.exec_window_start_hour ?? s.execWindowStartHour;
        s.execWindowEndHour = a.payload.exec_window_end_hour ?? s.execWindowEndHour;
        s.lastUpdated = Date.now();
      })
      .addCase(updateCreditExtensionDays.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string || 'Failed'; });

    builder
      .addCase(updateSettings.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(updateSettings.fulfilled, (s, a: PayloadAction<any>) => {
        s.isLoading = false;
        s.creditExtensionDays = a.payload.credit_extension_days ?? s.creditExtensionDays;
        s.notifEveryHours = a.payload.notif_every_hours ?? s.notifEveryHours;
        s.execWindowStartHour = a.payload.exec_window_start_hour ?? s.execWindowStartHour;
        s.execWindowEndHour = a.payload.exec_window_end_hour ?? s.execWindowEndHour;
        s.lastUpdated = Date.now();
      })
      .addCase(updateSettings.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string || 'Failed'; });
  }
});

export default settingsSlice.reducer;
