/**
 * Authentication Service
 * Handles all authentication-related API calls
 */

import { LoginCredentials, RegisterData, AuthResponse, RefreshResponse, User } from '../types/auth';

const API_URL = 'http://localhost:3009/api/auth';

export class AuthService {
  /**
   * Login user
   */
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login request failed' }));
      return { success: false, error: error.error || `HTTP error ${response.status}` };
    }

    return response.json();
  }

  /**
   * Register new user
   */
  static async register(data: RegisterData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Registration request failed' }));
      return { success: false, error: error.error || `HTTP error ${response.status}` };
    }

    return response.json();
  }

  /**
   * Refresh access token
   */
  static async refreshToken(): Promise<RefreshResponse> {
    const response = await fetch(`${API_URL}/refresh`, {
      method: 'POST',
      credentials: 'include', // Sends refresh token cookie
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Token refresh failed' }));
      return { success: false, error: error.error || `HTTP error ${response.status}` };
    }

    return response.json();
  }

  /**
   * Logout user
   */
  static async logout(accessToken: string): Promise<void> {
    await fetch(`${API_URL}/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });
  }

  /**
   * Get current user
   */
  static async getCurrentUser(accessToken: string): Promise<{ success: boolean; data?: { user: User }; error?: string }> {
    const response = await fetch(`${API_URL}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get user' }));
      return { success: false, error: error.error || `HTTP error ${response.status}` };
    }

    return response.json();
  }

  /**
   * Update password
   */
  static async updatePassword(
    accessToken: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const response = await fetch(`${API_URL}/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({ oldPassword, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Password update failed' }));
      return { success: false, error: error.error || `HTTP error ${response.status}` };
    }

    return response.json();
  }
}
