export const BACKEND_URL =
  (typeof window !== 'undefined' && (window as any).VITE_BACKEND_URL) || 'http://localhost:5000';

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
      this.refreshToken = localStorage.getItem('refresh_token');
    }
  }

  public setTokens(access: string, refresh: string): void {
    this.accessToken = access;
    this.refreshToken = refresh;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
    }
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }

  public async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && this.refreshToken && endpoint !== '/api/v1/auth/refresh') {
      // Attempt refresh
      const refreshed = await this.refreshTokens();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retryRes = await fetch(`${BACKEND_URL}${endpoint}`, {
          ...options,
          headers,
        });
        const json = await retryRes.json();
        if (!retryRes.ok) throw new Error(json.error?.message || 'Request failed');
        return json.data;
      }
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || `HTTP ${response.status}`);
    }
    return data.data;
  }

  private async refreshTokens(): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      }
    } catch {
      // Refresh failed
    }
    this.clearTokens();
    return false;
  }
}

export const apiClient = new ApiClient();
