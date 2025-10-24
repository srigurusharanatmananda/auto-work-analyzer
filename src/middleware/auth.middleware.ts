/**
 * Authentication & Authorization Middleware
 * Implements JWT-based authentication and RBAC
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService.js';
import { TokenPayload } from '../services/JWTService.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT access token from Authorization header
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const authService = new AuthService();
    const tokenPayload = authService.verifyAccessToken(token);
    authService.close();

    if (!tokenPayload) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Attach user to request
    req.user = tokenPayload;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if missing
 */
export function authenticateOptional(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    const authService = new AuthService();
    const tokenPayload = authService.verifyAccessToken(token);
    authService.close();

    if (tokenPayload) {
      req.user = tokenPayload;
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
}

/**
 * Authorization middleware - Role-based access control
 * Requires authenticate middleware to run first
 */
export function authorize(...roles: Array<'admin' | 'manager' | 'user'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

/**
 * Resource ownership check
 * Allows admins to access any resource, or users to access their own resources
 */
export function authorizeOwnership(getUserIdFromParams: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const resourceUserId = getUserIdFromParams(req);
    const isOwner = req.user.userId === resourceUserId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only access your own resources',
      });
      return;
    }

    next();
  };
}
