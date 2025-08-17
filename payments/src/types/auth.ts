export interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: 'admin' | 'accountant' | 'executive';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}
