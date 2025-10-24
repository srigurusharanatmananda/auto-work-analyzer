/**
 * Authentication Service
 * Orchestrates authentication operations
 * Implements defense-in-depth security principles
 */

import { v4 as uuidv4 } from 'uuid';
import { AuthDatabaseService, UserRecord } from './AuthDatabaseService.js';
import { PasswordService } from './PasswordService.js';
import { JWTService, TokenPayload, TokenPair } from './JWTService.js';

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  role?: 'admin' | 'manager' | 'user';
}

export interface LoginInput {
  email: string;
  password: string;
  ipAddress: string;
  userAgent: string;
}

export interface LoginResult {
  success: boolean;
  user?: Omit<UserRecord, 'password_hash'>;
  tokens?: TokenPair;
  error?: string;
}

export interface RefreshResult {
  success: boolean;
  tokens?: TokenPair;
  error?: string;
}

export class AuthService {
  private db: AuthDatabaseService;

  // Security limits
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly ACCOUNT_LOCK_DURATION_MINUTES = 30;
  private static readonly RATE_LIMIT_WINDOW_MINUTES = 15;
  private static readonly MAX_ATTEMPTS_PER_IP = 10;

  constructor() {
    this.db = new AuthDatabaseService();
  }

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      // Validate email format
      if (!this.isValidEmail(input.email)) {
        return { success: false, error: 'Invalid email format' };
      }

      // Validate password strength
      const passwordValidation = PasswordService.validateStrength(input.password);
      if (!passwordValidation.isValid) {
        return { success: false, error: passwordValidation.error };
      }

      // Check if user already exists
      const existingUser = this.db.getUserByEmail(input.email);
      if (existingUser) {
        return { success: false, error: 'Email already registered' };
      }

      // Hash password
      const passwordHash = await PasswordService.hash(input.password);

      // Create user
      const userId = uuidv4();
      const user: Omit<UserRecord, 'created_at' | 'updated_at' | 'failed_login_attempts'> = {
        id: userId,
        email: input.email,
        password_hash: passwordHash,
        full_name: input.fullName,
        role: input.role || 'user',
        is_active: true,
        email_verified: false, // Email verification can be added later
        last_login_at: undefined,
        locked_until: undefined,
      };

      this.db.createUser(user);

      return { success: true, userId };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registration failed' };
    }
  }

  /**
   * Login user
   */
  async login(input: LoginInput): Promise<LoginResult> {
    try {
      // Check rate limiting by IP
      const recentIPAttempts = this.db.getRecentFailedAttemptsByIP(
        input.ipAddress,
        AuthService.RATE_LIMIT_WINDOW_MINUTES
      );

      if (recentIPAttempts >= AuthService.MAX_ATTEMPTS_PER_IP) {
        this.db.logLoginAttempt({
          email: input.email,
          ip_address: input.ipAddress,
          user_agent: input.userAgent,
          success: false,
          failure_reason: 'IP rate limit exceeded',
        });

        return {
          success: false,
          error: 'Too many failed attempts. Please try again later.',
        };
      }

      // Get user
      const user = this.db.getUserByEmail(input.email);
      if (!user) {
        // Log failed attempt with generic message
        this.db.logLoginAttempt({
          email: input.email,
          ip_address: input.ipAddress,
          user_agent: input.userAgent,
          success: false,
          failure_reason: 'User not found',
        });

        // Generic error to prevent user enumeration
        return { success: false, error: 'Invalid email or password' };
      }

      // Check if account is locked
      if (user.locked_until) {
        const lockExpiry = new Date(user.locked_until);
        if (lockExpiry > new Date()) {
          const minutesRemaining = Math.ceil((lockExpiry.getTime() - Date.now()) / 60000);
          return {
            success: false,
            error: `Account is locked. Try again in ${minutesRemaining} minutes.`,
          };
        }
      }

      // Check if account is active
      if (!user.is_active) {
        this.db.logLoginAttempt({
          email: input.email,
          ip_address: input.ipAddress,
          user_agent: input.userAgent,
          success: false,
          failure_reason: 'Account disabled',
        });

        return { success: false, error: 'Account is disabled' };
      }

      // Verify password
      const passwordValid = await PasswordService.verify(input.password, user.password_hash);
      if (!passwordValid) {
        // Update failed attempts
        this.db.updateUserLogin(user.id, false);

        // Check if we need to lock account
        const updatedUser = this.db.getUserById(user.id);
        if (updatedUser && updatedUser.failed_login_attempts >= AuthService.MAX_FAILED_ATTEMPTS) {
          this.db.lockUserAccount(user.id, AuthService.ACCOUNT_LOCK_DURATION_MINUTES);
        }

        this.db.logLoginAttempt({
          email: input.email,
          ip_address: input.ipAddress,
          user_agent: input.userAgent,
          success: false,
          failure_reason: 'Invalid password',
        });

        return { success: false, error: 'Invalid email or password' };
      }

      // Successful login
      this.db.updateUserLogin(user.id, true);
      this.db.logLoginAttempt({
        email: input.email,
        ip_address: input.ipAddress,
        user_agent: input.userAgent,
        success: true,
      });

      // Generate tokens
      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
      };

      const tokens = JWTService.generateTokenPair(tokenPayload);

      // Store refresh token
      this.db.storeRefreshToken({
        id: tokens.refreshTokenId,
        user_id: user.id,
        token_hash: tokens.refreshTokenHash,
        expires_at: tokens.refreshTokenExpiry.toISOString(),
        user_agent: input.userAgent,
        ip_address: input.ipAddress,
      });

      // Remove password hash from response
      const { password_hash, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword,
        tokens,
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string, ipAddress: string, userAgent: string): Promise<RefreshResult> {
    try {
      // Verify refresh token
      let decoded;
      try {
        decoded = JWTService.verifyRefreshToken(refreshToken);
      } catch (error) {
        return { success: false, error: 'Invalid or expired refresh token' };
      }

      // Hash the token to look it up
      const tokenHash = JWTService.hashToken(refreshToken);

      // Check if token exists and is not revoked
      const storedToken = this.db.getRefreshToken(tokenHash);
      if (!storedToken || storedToken.revoked) {
        // Possible token reuse attack - revoke all tokens for this user
        this.db.revokeAllUserTokens(decoded.userId);
        return { success: false, error: 'Token reuse detected. All sessions revoked for security.' };
      }

      // Get user
      const user = this.db.getUserById(decoded.userId);
      if (!user || !user.is_active) {
        return { success: false, error: 'User not found or inactive' };
      }

      // Revoke old refresh token (token rotation)
      this.db.revokeRefreshToken(tokenHash);

      // Generate new token pair (maintain token family for rotation detection)
      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
      };

      const newTokens = JWTService.generateTokenPair(tokenPayload, decoded.tokenFamily);

      // Store new refresh token
      this.db.storeRefreshToken({
        id: newTokens.refreshTokenId,
        user_id: user.id,
        token_hash: newTokens.refreshTokenHash,
        expires_at: newTokens.refreshTokenExpiry.toISOString(),
        user_agent: userAgent,
        ip_address: ipAddress,
      });

      return {
        success: true,
        tokens: newTokens,
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      return { success: false, error: 'Failed to refresh token' };
    }
  }

  /**
   * Logout user (revoke tokens)
   */
  async logout(refreshToken: string, accessToken: string): Promise<{ success: boolean }> {
    try {
      // Revoke refresh token
      const refreshTokenHash = JWTService.hashToken(refreshToken);
      this.db.revokeRefreshToken(refreshTokenHash);

      // Add access token to blacklist
      const accessDecoded = JWTService.decodeToken(accessToken);
      if (accessDecoded && accessDecoded.jti && accessDecoded.exp) {
        this.db.blacklistToken(
          accessDecoded.jti,
          'access',
          new Date(accessDecoded.exp * 1000).toISOString(),
          'User logout'
        );
      }

      // Add refresh token to blacklist
      const refreshDecoded = JWTService.decodeToken(refreshToken);
      if (refreshDecoded && refreshDecoded.jti && refreshDecoded.exp) {
        this.db.blacklistToken(
          refreshDecoded.jti,
          'refresh',
          new Date(refreshDecoded.exp * 1000).toISOString(),
          'User logout'
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false };
    }
  }

  /**
   * Logout all sessions for a user
   */
  logoutAll(userId: string): void {
    this.db.revokeAllUserTokens(userId);
  }

  /**
   * Verify access token and check blacklist
   */
  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = JWTService.verifyAccessToken(token);

      // Check if token is blacklisted
      if (this.db.isTokenBlacklisted(decoded.jti)) {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user by ID
   */
  getUserById(userId: string): Omit<UserRecord, 'password_hash'> | null {
    const user = this.db.getUserById(userId);
    if (!user) return null;

    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = this.db.getUserById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Verify old password
      const passwordValid = await PasswordService.verify(oldPassword, user.password_hash);
      if (!passwordValid) {
        return { success: false, error: 'Current password is incorrect' };
      }

      // Validate new password
      const passwordValidation = PasswordService.validateStrength(newPassword);
      if (!passwordValidation.isValid) {
        return { success: false, error: passwordValidation.error };
      }

      // Hash new password
      const newPasswordHash = await PasswordService.hash(newPassword);

      // Update password
      this.db.updateUserPassword(userId, newPasswordHash);

      // Revoke all refresh tokens for security
      this.db.revokeAllUserTokens(userId);

      return { success: true };
    } catch (error) {
      console.error('Password update error:', error);
      return { success: false, error: 'Failed to update password' };
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Cleanup expired tokens (should be run periodically)
   */
  cleanupExpiredTokens(): void {
    this.db.cleanupExpiredTokens();
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
