'use client';

/**
 * Authentication Context
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AuthService } from '../services/authService';
import { User, AuthContextType, LoginCredentials, RegisterData } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setAccessToken(storedToken);
      setUser(JSON.parse(storedUser));
    }

    setIsLoading(false);
  }, []);

  // Auto refresh token before expiry
  useEffect(() => {
    if (!accessToken) return;

    // Refresh token 1 minute before expiry
    const expiresAt = localStorage.getItem('tokenExpiresAt');
    if (!expiresAt) return;

    const expiryTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const timeUntilRefresh = expiryTime - now - 60000; // 1 minute before expiry

    if (timeUntilRefresh > 0) {
      const timer = setTimeout(() => {
        refreshToken();
      }, timeUntilRefresh);

      return () => clearTimeout(timer);
    } else {
      // Token already expired, refresh immediately
      refreshToken();
    }
  }, [accessToken]);

  /**
   * Login user
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      const response = await AuthService.login(credentials);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Login failed');
      }

      const { user, accessToken, expiresAt } = response.data;

      // Store in state
      setUser(user);
      setAccessToken(accessToken);

      // Store in localStorage
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('tokenExpiresAt', expiresAt);

      toast.success('Login successful!');
      router.push('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      toast.error(message);
      throw error;
    }
  }, [router]);

  /**
   * Register new user
   */
  const register = useCallback(async (data: RegisterData) => {
    try {
      const response = await AuthService.register(data);

      if (!response.success) {
        throw new Error(response.error || 'Registration failed');
      }

      toast.success('Registration successful! Please login.');
      router.push('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      toast.error(message);
      throw error;
    }
  }, [router]);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    try {
      if (accessToken) {
        await AuthService.logout(accessToken);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear state
      setUser(null);
      setAccessToken(null);

      // Clear localStorage
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('tokenExpiresAt');

      toast.success('Logged out successfully');
      router.push('/login');
    }
  }, [accessToken, router]);

  /**
   * Refresh access token
   */
  const refreshToken = useCallback(async () => {
    try {
      const response = await AuthService.refreshToken();

      if (!response.success || !response.data) {
        // Refresh failed, logout user
        await logout();
        return;
      }

      const { accessToken, expiresAt } = response.data;

      // Update state
      setAccessToken(accessToken);

      // Update localStorage
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('tokenExpiresAt', expiresAt);
    } catch (error) {
      console.error('Token refresh error:', error);
      await logout();
    }
  }, [logout]);

  /**
   * Update password
   */
  const updatePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await AuthService.updatePassword(accessToken, oldPassword, newPassword);

      if (!response.success) {
        throw new Error(response.error || 'Password update failed');
      }

      toast.success('Password updated successfully! Please login again.');

      // Logout user since all sessions are revoked
      await logout();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password update failed';
      toast.error(message);
      throw error;
    }
  }, [accessToken, logout]);

  const value: AuthContextType = {
    user,
    accessToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
