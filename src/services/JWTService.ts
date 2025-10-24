/**
 * JWT Service
 * Handles JWT token generation and verification
 * Following OWASP 2025 and JWT Security Best Practices
 *
 * Features:
 * - Short-lived access tokens (15 minutes)
 * - Long-lived refresh tokens (7 days)
 * - Token rotation on refresh
 * - JTI (JWT ID) for token revocation
 * - Secure algorithm (HS256)
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  fullName: string;
}

export interface AccessTokenPayload extends TokenPayload {
  type: 'access';
  jti: string;
}

export interface RefreshTokenPayload {
  userId: string;
  type: 'refresh';
  jti: string;
  tokenFamily: string; // For token rotation detection
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: Date;
  refreshTokenExpiry: Date;
  refreshTokenId: string;
  refreshTokenHash: string;
}

export class JWTService {
  // Access token expires in 15 minutes (OWASP recommends short-lived tokens)
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000;

  // Refresh token expires in 7 days
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';
  private static readonly REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

  // JWT secret keys (should be stored in environment variables in production)
  private static readonly ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET ||
    'change-this-secret-in-production-use-long-random-string-min-256-bits';
  private static readonly REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET ||
    'change-this-refresh-secret-in-production-use-different-long-random-string';

  // Issuer and audience for additional security
  private static readonly ISSUER = 'auto-work-analyzer';
  private static readonly AUDIENCE = 'auto-work-analyzer-api';

  /**
   * Generate a token pair (access + refresh tokens)
   */
  static generateTokenPair(payload: TokenPayload, tokenFamily?: string): TokenPair {
    const accessJti = uuidv4();
    const refreshJti = uuidv4();
    const family = tokenFamily || uuidv4();

    // Generate access token
    const accessTokenPayload: AccessTokenPayload = {
      ...payload,
      type: 'access',
      jti: accessJti,
    };

    const accessToken = jwt.sign(accessTokenPayload, this.ACCESS_TOKEN_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: this.ISSUER,
      audience: this.AUDIENCE,
      algorithm: 'HS256',
    });

    // Generate refresh token
    const refreshTokenPayload: RefreshTokenPayload = {
      userId: payload.userId,
      type: 'refresh',
      jti: refreshJti,
      tokenFamily: family,
    };

    const refreshToken = jwt.sign(refreshTokenPayload, this.REFRESH_TOKEN_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: this.ISSUER,
      audience: this.AUDIENCE,
      algorithm: 'HS256',
    });

    // Calculate expiry dates
    const now = Date.now();
    const accessTokenExpiry = new Date(now + this.ACCESS_TOKEN_EXPIRY_MS);
    const refreshTokenExpiry = new Date(now + this.REFRESH_TOKEN_EXPIRY_MS);

    // Hash refresh token for storage (never store plain tokens)
    const refreshTokenHash = this.hashToken(refreshToken);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiry,
      refreshTokenExpiry,
      refreshTokenId: refreshJti,
      refreshTokenHash,
    };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, this.ACCESS_TOKEN_SECRET, {
        issuer: this.ISSUER,
        audience: this.AUDIENCE,
        algorithms: ['HS256'],
      }) as AccessTokenPayload;

      // Verify token type
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      } else {
        throw error;
      }
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, this.REFRESH_TOKEN_SECRET, {
        issuer: this.ISSUER,
        audience: this.AUDIENCE,
        algorithms: ['HS256'],
      }) as RefreshTokenPayload;

      // Verify token type
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      } else {
        throw error;
      }
    }
  }

  /**
   * Decode token without verification (for extracting claims like exp, jti)
   */
  static decodeToken(token: string): any {
    return jwt.decode(token);
  }

  /**
   * Hash token for secure storage
   * Uses SHA-256 for fast, secure hashing
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Get token expiry date from token
   */
  static getTokenExpiry(token: string): Date | null {
    try {
      const decoded = this.decodeToken(token);
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired (without verification)
   */
  static isTokenExpired(token: string): boolean {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) return true;
    return expiry.getTime() < Date.now();
  }

  /**
   * Validate JWT configuration
   */
  static validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if secrets are set and strong enough
    if (this.ACCESS_TOKEN_SECRET.includes('change-this')) {
      errors.push('JWT_ACCESS_SECRET not set in environment variables');
    }

    if (this.REFRESH_TOKEN_SECRET.includes('change-this')) {
      errors.push('JWT_REFRESH_SECRET not set in environment variables');
    }

    if (this.ACCESS_TOKEN_SECRET === this.REFRESH_TOKEN_SECRET) {
      errors.push('Access and refresh token secrets must be different');
    }

    // Check secret strength (minimum 256 bits = 32 characters)
    if (this.ACCESS_TOKEN_SECRET.length < 32) {
      errors.push('JWT_ACCESS_SECRET is too short (minimum 32 characters recommended)');
    }

    if (this.REFRESH_TOKEN_SECRET.length < 32) {
      errors.push('JWT_REFRESH_SECRET is too short (minimum 32 characters recommended)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
