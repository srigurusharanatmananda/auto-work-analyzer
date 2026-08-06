/**
 * Authentication & Authorization Middleware
 * Implements JWT-based authentication and RBAC
 */

import { Request, Response, NextFunction } from 'express';
import { getSharedAuthService } from '../services/AuthService.js';
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
 * Resolves a bearer token to the identity a request should act as, or null.
 *
 * Signature, expiry, issuer, audience, type and blacklist are checked by
 * `verifyAccessToken`. This adds the part that cannot be carried in a token:
 * the current state of the account.
 *
 * Two things follow from re-reading the row, and both are the point:
 *  - a deleted or deactivated user is rejected immediately, instead of keeping
 *    access for the remainder of a 15-minute access token — precisely the
 *    window in which deactivation needs to work;
 *  - the role is taken from the row, not the token, so demoting a user takes
 *    effect on their next request rather than at their next login.
 *
 * The cost is two indexed primary-key lookups (the blacklist check and the user
 * row) on the shared connection pool.
 */
async function resolveIdentity(token: string): Promise<TokenPayload | null> {
  const authService = getSharedAuthService();

  const tokenPayload = await authService.verifyAccessToken(token);
  if (!tokenPayload) return null;

  const user = await authService.getUserById(tokenPayload.userId);
  if (!user || !user.is_active) return null;

  return { ...tokenPayload, role: user.role };
}

/**
 * Authentication middleware
 * Verifies JWT access token from Authorization header
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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

    const tokenPayload = await resolveIdentity(token);

    if (!tokenPayload) {
      // One message for every failure mode. Distinguishing "expired" from
      // "deactivated" from "no such user" would tell a caller which of those it
      // is, and none of them is information they are owed.
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
export async function authenticateOptional(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    const tokenPayload = await resolveIdentity(token);

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
