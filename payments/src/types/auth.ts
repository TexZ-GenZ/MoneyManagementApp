export interface User {
  id: string;
  username: string;
  role: 'admin' | 'accountant' | 'executive';
  area?: string | null;
  mobile?: string | null;
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
