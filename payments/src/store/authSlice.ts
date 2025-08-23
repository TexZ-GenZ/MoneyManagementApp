import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { AuthState, User, LoginCredentials } from "../types/auth";
import ApiService from "../services/api";
import { StorageService, AuthToken } from "../services/storageService";

const initialState: AuthState = {
  user: null,
  token: null,         // will hold "Bearer <access_token>"
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Async thunks
export const loginUser = createAsyncThunk(
  "auth/login",
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await ApiService.login(credentials);

      // Build token object
      const tokenInterface: AuthToken = {
        access_token: response.access_token,
        token_type: response.token_type,
      };

      await StorageService.saveToken(tokenInterface);

      // Try to fetch current user immediately after login
      let user = null;
      try {
        user = await ApiService.getCurrentUser();
      } catch (err) {
        // ignore; user may not be available immediately
      }

      return {
        access_token: response.access_token,
        token_type: response.token_type,
        user,
      };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const initializeAuth = createAsyncThunk(
  "auth/initialize",
  async (_, { rejectWithValue }) => {
    try {
      const token = await StorageService.getToken();
      if (!token) return null;

      // If we have a token, validate it by fetching the current user
      try {
        const user = await ApiService.getCurrentUser();
        return {
          token: `${token.token_type} ${token.access_token}`,
          user,
        };
      } catch (err) {
        // Token invalid or /auth/me failed -> clear token and return null
        await StorageService.deleteToken();
        return null;
      }
    } catch (error: any) {
      await StorageService.deleteToken();
      return null;
    }
  }
);

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  await StorageService.deleteToken();
  return null;
});

export const getCurrentUser = createAsyncThunk(
  "auth/getCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      return await ApiService.getCurrentUser();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const refreshToken = createAsyncThunk(
  "auth/refreshToken",
  async (_, { rejectWithValue }) => {
    try {
      const token = await StorageService.getToken();
      if (!token) return null;
      return `${token.token_type} ${token.access_token}`;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = `${action.payload.token_type} ${action.payload.access_token}`;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      // Initialize
      .addCase(initializeAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.token = action.payload.token;
          state.user = action.payload.user || null;
          state.isAuthenticated = true;
        } else {
          state.user = null;
          state.token = null;
          state.isAuthenticated = false;
        }
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      })
      // Get current user
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload;
          state.isAuthenticated = true;
        }
      })
      // Refresh
      .addCase(refreshToken.fulfilled, (state, action) => {
        if (action.payload) {
          state.token = action.payload;
        } else {
          state.user = null;
          state.token = null;
          state.isAuthenticated = false;
        }
      });
  },
});

export const { clearError, setUser, clearAuth } = authSlice.actions;
export default authSlice.reducer;
