/**
 * Authentication Types
 */

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'user';
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  last_login_at?: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
}

export interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updatePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    accessToken: string;
    expiresAt: string;
  };
  error?: string;
}

export interface RefreshResponse {
  success: boolean;
  data?: {
    accessToken: string;
    expiresAt: string;
  };
  error?: string;
}
