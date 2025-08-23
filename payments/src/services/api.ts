import { config } from "../utils/config";
import { getErrorMessage } from "../utils/helpers";
import { StorageService } from "./storageService";
import type { LoginCredentials, LoginResponse, User } from "../types/auth";
import type { Company } from "../types/company";
import type { Bill } from "../types/bill";
import type { Payment, PaymentForm } from "../types/payment";
import type { Notification } from "../types/notification";

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = config.api.baseURL;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    // Use secure StorageService (expo-secure-store) to read token saved by auth flow
    const authHeader = await StorageService.getAuthHeader();
    return {
      "Content-Type": "application/json",
      ...authHeader,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  // Auth API
  async login(
    credentials: LoginCredentials
  ): Promise<{ access_token: string; token_type: string }> {
    // Use the exact login URL to avoid accidental baseURL concatenation
    const loginUrl = "https://moneymanagementapp-production.up.railway.app/auth/login";

    const res = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
    }

    const response = await res.json();
    return {
      access_token: response.access_token,
      token_type: response.token_type,
    };
  }

  async logout(): Promise<void> {
    return this.request<void>("/auth/logout", {
      method: "POST",
    });
  }

  async refreshToken(): Promise<{ token: string }> {
    const tokenObj = await StorageService.getToken();
  const refresh_token = (tokenObj as any)?.refresh_token;
    if (!refresh_token) {
      throw new Error("No refresh token available");
    }

    const response = await this.request<{
      access_token: string;
      refresh_token: string;
    }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    });

    return { token: response.access_token };
  }

  // User API
  async getCurrentUser(): Promise<User> {
    const response = await this.request<{
      id: number;
      name: string;
      email: string;
      phone?: string;
      role: string;
      is_active: boolean;
      created_at: string;
      updated_at?: string;
    }>("/auth/me");

    return {
      id: response.id.toString(),
      username: response.email,
      firstName: response.name.split(" ")[0],
      lastName: response.name.split(" ").slice(1).join(" "),
      email: response.email,
      role: response.role as "admin" | "accountant" | "executive",
      isActive: response.is_active,
      createdAt: response.created_at,
      updatedAt: response.updated_at || response.created_at,
    };
  }

  async getUsers(): Promise<User[]> {
    return this.request<User[]>("/users");
  }

  async createUser(
    userData: Omit<User, "id" | "createdAt" | "updatedAt">
  ): Promise<User> {
    return this.request<User>("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    return this.request<User>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: string): Promise<void> {
    return this.request<void>(`/users/${id}`, {
      method: "DELETE",
    });
  }

  // Company API
  async getCompanies(): Promise<Company[]> {
    return this.request<Company[]>("/companies");
  }

  async getCompanyByCode(code: string): Promise<Company> {
    return this.request<Company>(`/companies/${code}`);
  }

  async updateCompany(
    code: string,
    companyData: Partial<Company>
  ): Promise<Company> {
    return this.request<Company>(`/companies/${code}`, {
      method: "PUT",
      body: JSON.stringify(companyData),
    });
  }

  async getExecutiveCompanies(executiveId: string): Promise<Company[]> {
    return this.request<Company[]>(`/companies/executive/${executiveId}`);
  }

  // Bill API
  async getBills(): Promise<Bill[]> {
    return this.request<Bill[]>("/bills");
  }

  async getCompanyBills(companyCode: string): Promise<Bill[]> {
    return this.request<Bill[]>(`/bills/company/${companyCode}`);
  }

  async getPendingBills(): Promise<Bill[]> {
    return this.request<Bill[]>("/bills/pending");
  }

  async getPaidBills(): Promise<Bill[]> {
    return this.request<Bill[]>("/bills/paid");
  }

  async updateBill(id: string, billData: Partial<Bill>): Promise<Bill> {
    return this.request<Bill>(`/bills/${id}`, {
      method: "PUT",
      body: JSON.stringify(billData),
    });
  }

  // Payment API
  async getPayments(): Promise<Payment[]> {
    return this.request<Payment[]>("/payments");
  }

  async submitPayment(
    paymentData: PaymentForm & { companyCode: string }
  ): Promise<Payment> {
    return this.request<Payment>("/payments", {
      method: "POST",
      body: JSON.stringify(paymentData),
    });
  }

  async getPendingPayments(): Promise<Payment[]> {
    return this.request<Payment[]>("/payments/pending");
  }

  async getExecutivePayments(executiveId: string): Promise<Payment[]> {
    return this.request<Payment[]>(`/payments/executive/${executiveId}`);
  }

  async approvePayment(
    paymentId: string,
    approval: { approved: boolean; comments?: string }
  ): Promise<Payment> {
    return this.request<Payment>(`/payments/${paymentId}/approve`, {
      method: "PUT",
      body: JSON.stringify(approval),
    });
  }

  async adminApprovePayment(
    paymentId: string,
    approval: { approved: boolean; comments?: string }
  ): Promise<Payment> {
    return this.request<Payment>(`/payments/${paymentId}/admin-approve`, {
      method: "PUT",
      body: JSON.stringify(approval),
    });
  }

  // Notification API
  async getNotifications(): Promise<Notification[]> {
    return this.request<Notification[]>("/notifications");
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    return this.request<void>(`/notifications/${notificationId}/read`, {
      method: "PUT",
    });
  }

  async markAllNotificationsAsRead(): Promise<void> {
    return this.request<void>("/notifications/read-all", {
      method: "PUT",
    });
  }

  // Dashboard API
  async getDashboardStats(): Promise<any> {
    return this.request<any>("/dashboard/stats");
  }

  async getExecutiveDashboardStats(executiveId: string): Promise<any> {
    return this.request<any>(`/dashboard/executive/${executiveId}`);
  }

  async getAccountantDashboardStats(): Promise<any> {
    return this.request<any>("/dashboard/accountant");
  }

  async getAdminDashboardStats(): Promise<any> {
    return this.request<any>("/dashboard/admin");
  }

  // Settings API
  async getSettings(): Promise<any> {
    return this.request<any>("/settings");
  }

  async updateSettings(settings: any): Promise<any> {
    return this.request<any>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  // Import API
  async importMasterData(
    file: FormData
  ): Promise<{ message: string; imported: number }> {
    const headers = await this.getAuthHeaders();
    delete headers["Content-Type"]; // Let browser set multipart boundary

    const response = await fetch(`${this.baseURL}/import/master`, {
      method: "POST",
      headers,
      body: file,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  }

  async importTransactionData(
    file: FormData
  ): Promise<{ message: string; imported: number }> {
    const headers = await this.getAuthHeaders();
    delete headers["Content-Type"]; // Let browser set multipart boundary

    const response = await fetch(`${this.baseURL}/import/transactions`, {
      method: "POST",
      headers,
      body: file,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  }
}

export default new ApiService();
