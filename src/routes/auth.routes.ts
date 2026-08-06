/**
 * Authentication Routes
 * Handles user registration, login, token refresh, and logout
 */

import { Router, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { AuthService } from '../services/AuthService.js';
import { JWTService } from '../services/JWTService.js';
import { PasswordService } from '../services/PasswordService.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { anyRole } from '../middleware/policy.js';
import {
  authRateLimiter,
  validate,
  registerValidation,
  loginValidation,
  passwordUpdateValidation,
  userUpdateValidation,
  sanitizeInput,
} from '../middleware/security.middleware.js';

const router = Router();

// Apply sanitization to all auth routes
router.use(sanitizeInput);
router.use(cookieParser());

/**
 * Register new user
 * POST /api/auth/register
 */
router.post(
  '/register',
  authRateLimiter,
  registerValidation,
  validate,
  async (req: Request, res: Response) => {
    try {
      // `role` is deliberately NOT read from the body. This endpoint is public
      // and unauthenticated, so honouring a caller-supplied role would let
      // anyone who can reach the port mint themselves an admin. A role field in
      // the request is ignored, not rejected — rejecting it would tell an
      // attacker the field exists. Roles are assigned by an admin afterwards
      // (PUT /api/users/:id/role) or by the one-time /setup bootstrap.
      const { email, password, fullName } = req.body;

      const authService = new AuthService();
      const result = await authService.register({
        email,
        password,
        fullName,
      });
      authService.close();

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          userId: result.userId,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed',
      });
    }
  }
);

/**
 * Login
 * POST /api/auth/login
 */
router.post(
  '/login',
  authRateLimiter,
  loginValidation,
  validate,
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const ipAddress = (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
      const userAgent = req.headers['user-agent'] || 'unknown';

      const authService = new AuthService();
      const result = await authService.login({
        email,
        password,
        ipAddress,
        userAgent,
      });
      authService.close();

      if (!result.success) {
        res.status(401).json({
          success: false,
          error: result.error,
        });
        return;
      }

      // Set refresh token as HttpOnly cookie (more secure)
      res.cookie('refreshToken', result.tokens!.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/auth', // Only send to auth endpoints
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.tokens!.accessToken,
          expiresAt: result.tokens!.accessTokenExpiry,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed',
      });
    }
  }
);

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        error: 'No refresh token provided',
      });
      return;
    }

    const ipAddress = (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
    const userAgent = req.headers['user-agent'] || 'unknown';

    const authService = new AuthService();
    const result = await authService.refreshToken(refreshToken, ipAddress, userAgent);
    authService.close();

    if (!result.success) {
      // Clear cookie on failure
      res.clearCookie('refreshToken', { path: '/api/auth' });

      res.status(401).json({
        success: false,
        error: result.error,
      });
      return;
    }

    // Update refresh token cookie
    res.cookie('refreshToken', result.tokens!.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: result.tokens!.accessToken,
        expiresAt: result.tokens!.accessTokenExpiry,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
    });
  }
});

/**
 * Logout
 * POST /api/auth/logout
 * Requires authentication
 */
router.post('/logout', authenticate, anyRole, async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    const accessToken = req.headers.authorization?.substring(7); // Remove 'Bearer '

    if (!refreshToken || !accessToken) {
      res.status(400).json({
        success: false,
        error: 'Missing tokens',
      });
      return;
    }

    const authService = new AuthService();
    await authService.logout(refreshToken, accessToken);
    authService.close();

    // Clear refresh token cookie
    res.clearCookie('refreshToken', { path: '/api/auth' });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
    });
  }
});

/**
 * Logout all sessions
 * POST /api/auth/logout-all
 * Requires authentication
 */
router.post('/logout-all', authenticate, anyRole, async (req: Request, res: Response) => {
  try {
    const authService = new AuthService();
    authService.logoutAll(req.user!.userId);
    authService.close();

    // Clear refresh token cookie
    res.clearCookie('refreshToken', { path: '/api/auth' });

    res.json({
      success: true,
      message: 'All sessions logged out successfully',
    });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to logout all sessions',
    });
  }
});

/**
 * Get current user
 * GET /api/auth/me
 * Requires authentication
 */
router.get('/me', authenticate, anyRole, async (req: Request, res: Response) => {
  try {
    const authService = new AuthService();
    const user = authService.getUserById(req.user!.userId);
    authService.close();

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user',
    });
  }
});

/**
 * Update password
 * PUT /api/auth/password
 * Requires authentication
 */
router.put(
  '/password',
  authenticate,
  anyRole,
  passwordUpdateValidation,
  validate,
  async (req: Request, res: Response) => {
    try {
      const { oldPassword, newPassword } = req.body;

      const authService = new AuthService();
      const result = await authService.updatePassword(
        req.user!.userId,
        oldPassword,
        newPassword
      );
      authService.close();

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      // Clear refresh token since all tokens are revoked
      res.clearCookie('refreshToken', { path: '/api/auth' });

      res.json({
        success: true,
        message: 'Password updated successfully. Please login again.',
      });
    } catch (error) {
      console.error('Password update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update password',
      });
    }
  }
);

/**
 * Create default admin user
 * POST /api/auth/setup
 * Only works if no users exist
 */
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;

    // Check if any users exist
    const authService = new AuthService();
    const existingUser = authService.getUserById(''); // This will return null

    // Create a temporary auth db service to check user count
    const { AuthDatabaseService } = await import('../services/AuthDatabaseService.js');
    const db = new AuthDatabaseService();

    // Check if any user exists by trying to get all users with limit 1
    const users = await db.getAllUsers(1, 0);

    if (users.length > 0) {
      db.close();
      authService.close();
      res.status(403).json({
        success: false,
        error: 'Setup already completed. Users already exist.',
      });
      return;
    }

    db.close();

    // Create admin user
    const result = await authService.register({
      email: email || 'admin@auto-work-analyzer.local',
      password: password || PasswordService.generateRandomPassword(16),
      fullName: fullName || 'System Administrator',
      role: 'admin',
    });

    authService.close();

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        userId: result.userId,
        email: email || 'admin@auto-work-analyzer.local',
        // Include generated password only if it was auto-generated
        ...((!password) && { temporaryPassword: 'Check server logs for the generated password' }),
      },
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Setup failed',
    });
  }
});

/**
 * Get user settings
 * GET /api/auth/settings
 */
router.get('/settings', authenticate, anyRole, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const authService = new AuthService();
    const settings = await authService.getUserSettings(userId);
    authService.close();

    // Return default settings if none exist
    const defaultSettings = {
      default_assignee: '',
      backend_url: 'http://localhost:3009',
      clickup_team_id: '',
      clickup_list_id: '',
    };

    // `clickup_api_key` is deliberately stripped. ClickUp credentials live in
    // clickup_destinations, encrypted; this endpoint used to hand the plaintext
    // column straight back, so PUT-then-GET was a working round trip for an
    // unencrypted credential — beside a destinations subsystem built on the
    // premise that a key not present on an object cannot leak through one.
    // Migration 002 nulls the column; this stops it being read.
    const { clickup_api_key: _omitted, ...safeSettings } = (settings ?? defaultSettings) as Record<string, unknown>;

    res.json({
      success: true,
      data: safeSettings,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get settings',
    });
  }
});

/**
 * Update user settings
 * PUT /api/auth/settings
 */
router.put('/settings', authenticate, anyRole, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { default_assignee, backend_url, clickup_api_key, clickup_team_id, clickup_list_id } = req.body;

    // Refused rather than ignored: silently dropping it would leave a caller
    // believing their key was saved. Storing it would reintroduce a plaintext
    // credential that migration 002 exists to remove.
    if (clickup_api_key) {
      res.status(400).json({
        success: false,
        error:
          'ClickUp API keys are no longer stored here. Add a destination at /settings/destinations — keys are encrypted per destination.',
      });
      return;
    }

    const authService = new AuthService();
    await authService.upsertUserSettings(userId, {
      default_assignee,
      backend_url,
      clickup_team_id,
      clickup_list_id,
    });

    const updatedSettings = await authService.getUserSettings(userId);
    authService.close();

    const { clickup_api_key: _stripped, ...safeUpdated } = (updatedSettings ?? {}) as Record<string, unknown>;

    res.json({
      success: true,
      data: safeUpdated,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
    });
  }
});

export default router;
