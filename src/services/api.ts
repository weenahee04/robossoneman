import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type {
  User,
  Branch,
  WashSession,
  Coupon,
  UserCoupon,
  PointsTransaction,
  Stamp,
  Notification,
  LoginResponse,
  ApiResponse,
  PaginatedResponse,
  Vehicle,
  Promotion,
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    this.client.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (res) => res,
      async (error) => {
        if (error.response?.status === 401) {
          this.accessToken = null;
          localStorage.removeItem('roboss_token');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );

    const stored = localStorage.getItem('roboss_token');
    if (stored) this.accessToken = stored;
  }

  setToken(token: string) {
    this.accessToken = token;
    localStorage.setItem('roboss_token', token);
  }

  clearToken() {
    this.accessToken = null;
    localStorage.removeItem('roboss_token');
  }

  getToken(): string | null {
    return this.accessToken;
  }

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    const res = await this.client.request<ApiResponse<T>>(config);
    return res.data.data;
  }

  // ── Auth ────────────────────────────────────────────
  async loginWithLine(lineAccessToken: string): Promise<LoginResponse> {
    const res = await this.client.post<ApiResponse<LoginResponse>>('/auth/line', {
      accessToken: lineAccessToken,
    });
    const { tokens } = res.data.data;
    this.setToken(tokens.accessToken);
    return res.data.data;
  }

  async getMe(): Promise<User> {
    return this.request<User>({ method: 'GET', url: '/auth/me' });
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } finally {
      this.clearToken();
    }
  }

  // ── Users ───────────────────────────────────────────
  async updateProfile(data: Partial<User>): Promise<User> {
    return this.request<User>({ method: 'PATCH', url: '/users/me', data });
  }

  // ── Branches ────────────────────────────────────────
  async getBranches(): Promise<Branch[]> {
    return this.request<Branch[]>({ method: 'GET', url: '/branches' });
  }

  async getBranch(id: string): Promise<Branch> {
    return this.request<Branch>({ method: 'GET', url: `/branches/${id}` });
  }

  // ── Wash Sessions ───────────────────────────────────
  async createSession(data: {
    branchId: string;
    machineId: string;
    packageId: string;
    carSize: 'S' | 'M' | 'L';
    addons: string[];
    totalPrice: number;
    couponId?: string;
  }): Promise<WashSession> {
    return this.request<WashSession>({ method: 'POST', url: '/sessions', data });
  }

  async confirmPayment(sessionId: string): Promise<WashSession> {
    return this.request<WashSession>({
      method: 'POST',
      url: `/sessions/${sessionId}/confirm-payment`,
    });
  }

  async rateSession(sessionId: string, rating: number, reviewText?: string): Promise<WashSession> {
    return this.request<WashSession>({
      method: 'POST',
      url: `/sessions/${sessionId}/rate`,
      data: { rating, reviewText },
    });
  }

  async getSessionHistory(page = 1, limit = 20): Promise<PaginatedResponse<WashSession>> {
    const res = await this.client.get<PaginatedResponse<WashSession>>('/sessions/history', {
      params: { page, limit },
    });
    return res.data;
  }

  // ── Points ──────────────────────────────────────────
  async getPointsBalance(): Promise<{ balance: number; tier: string }> {
    return this.request<{ balance: number; tier: string }>({
      method: 'GET',
      url: '/points/balance',
    });
  }

  async getPointsHistory(page = 1, limit = 20): Promise<PaginatedResponse<PointsTransaction>> {
    const res = await this.client.get<PaginatedResponse<PointsTransaction>>('/points/history', {
      params: { page, limit },
    });
    return res.data;
  }

  async redeemPoints(data: { amount: number; rewardId: string }): Promise<PointsTransaction> {
    return this.request<PointsTransaction>({ method: 'POST', url: '/points/redeem', data });
  }

  // ── Coupons ─────────────────────────────────────────
  async getCoupons(): Promise<UserCoupon[]> {
    return this.request<UserCoupon[]>({ method: 'GET', url: '/coupons' });
  }

  async claimCoupon(code: string): Promise<UserCoupon> {
    return this.request<UserCoupon>({ method: 'POST', url: '/coupons/claim', data: { code } });
  }

  async useCoupon(couponId: string, sessionId: string): Promise<UserCoupon> {
    return this.request<UserCoupon>({
      method: 'POST',
      url: `/coupons/${couponId}/use`,
      data: { sessionId },
    });
  }

  // ── Stamps ──────────────────────────────────────────
  async getStamps(): Promise<Stamp> {
    return this.request<Stamp>({ method: 'GET', url: '/stamps' });
  }

  async claimStampReward(): Promise<Stamp> {
    return this.request<Stamp>({ method: 'POST', url: '/stamps/claim-reward' });
  }

  // ── Notifications ───────────────────────────────────
  async getNotifications(page = 1, limit = 20): Promise<PaginatedResponse<Notification>> {
    const res = await this.client.get<PaginatedResponse<Notification>>('/notifications', {
      params: { page, limit },
    });
    return res.data;
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.client.patch(`/notifications/${id}/read`);
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.client.patch('/notifications/read-all');
  }

  // ── Feedback ────────────────────────────────────────
  async submitFeedback(data: { type: string; message: string }): Promise<void> {
    await this.client.post('/feedback', data);
  }

  // ── Referrals ───────────────────────────────────────
  async getReferralInfo(): Promise<{ code: string; count: number; pointsEarned: number }> {
    return this.request<{ code: string; count: number; pointsEarned: number }>({
      method: 'GET',
      url: '/referrals',
    });
  }

  // ── Vehicles ──────────────────────────────────────
  async getVehicles(): Promise<Vehicle[]> {
    return this.request<Vehicle[]>({ method: 'GET', url: '/vehicles' });
  }

  async createVehicle(data: Omit<Vehicle, 'id' | 'userId' | 'createdAt'>): Promise<Vehicle> {
    return this.request<Vehicle>({ method: 'POST', url: '/vehicles', data });
  }

  async deleteVehicle(id: string): Promise<void> {
    await this.client.delete(`/vehicles/${id}`);
  }

  // ── Promotions ────────────────────────────────────
  async getPromotions(branchId?: string): Promise<Promotion[]> {
    return this.request<Promotion[]>({
      method: 'GET',
      url: '/promotions',
      params: branchId ? { branchId } : undefined,
    });
  }
}

export const api = new ApiClient();
export default api;
