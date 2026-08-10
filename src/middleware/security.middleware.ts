/**
 * Security Middleware
 * Rate limiting, input validation, and security headers
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { body, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { PostgresRateLimitStore } from './PostgresRateLimitStore.js';

/**
 * Fifteen minutes, shared by all three limiters below. Named once so the
 * `windowMs` passed to `rateLimit()` and the one passed to each limiter's
 * `PostgresRateLimitStore` cannot drift apart — a store whose own idea of the
 * window differs from the limiter's `max` would silently mis-time resets.
 */
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/**
 * Rate limiter for authentication endpoints
 * Stricter limits to prevent brute force attacks
 *
 * Backed by Postgres, not the default in-memory store: see
 * `PostgresRateLimitStore.ts` for why. `limiter: 'auth'` scopes this
 * limiter's rows away from `apiRateLimiter`'s and `mediaFetchRateLimiter`'s,
 * which matters because all three fall back to the same key — the caller's
 * IP — for an unauthenticated request.
 */
export const authRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 5, // 5 requests per window
  message: {
    success: false,
    error: 'Too many attempts',
    message: 'Too many login attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests from counting
  skipSuccessfulRequests: true,
  store: new PostgresRateLimitStore({ limiter: 'auth', windowMs: FIFTEEN_MINUTES_MS }),
});

/**
 * Rate limiter for general API endpoints
 */
export const apiRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 100, // 100 requests per window
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new PostgresRateLimitStore({ limiter: 'api', windowMs: FIFTEEN_MINUTES_MS }),
});

/**
 * Rate limiter for pulling a recording in from a link.
 *
 * Much tighter than `apiRateLimiter`, because the cost of a request here is not
 * the request. The caller sends a URL — a few dozen bytes — and the server
 * answers by downloading up to 500 MB and then spending Whisper time on it. At
 * the general limit of 100 per window that is 50 GB of egress and a saturated
 * transcription queue from one caller, entirely within the rules.
 *
 * Keyed on the user, not the IP: this route is behind `authenticate`, so there
 * is a better identity available than an address that a proxy may be
 * collapsing across everyone in an office.
 */
export const mediaFetchRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 10,
  message: {
    success: false,
    error: 'Too many recordings requested',
    message:
      'Fetching a recording from a link is limited to 10 per 15 minutes. Upload the file directly if you need more.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Only successful fetches count. A refused link — wrong scheme, private
  // address, unsupported format — costs a string comparison, and charging it to
  // a budget that exists for *bandwidth* means someone working out which link
  // format is accepted gets locked out after ten typos. Probing is still
  // bounded, by the general 100-per-window `apiRateLimiter` that covers
  // everything; this limiter is the narrower one for the expensive case.
  skipFailedRequests: true,
  // Falls back to the IP for the unauthenticated case, which should not reach
  // here at all — but a limiter that silently keys everything to `undefined`
  // when the assumption breaks is a limiter with one shared bucket.
  //
  // The fallback goes through `ipKeyGenerator` rather than using `req.ip`
  // directly: a raw IPv6 address is a /128 out of a /64 the client can rotate
  // freely, so keying on it is the same as not keying at all. The helper
  // normalises to the prefix. express-rate-limit refuses to start without it.
  keyGenerator: (req: Request): string => {
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    return userId ?? `ip:${ipKeyGenerator(req.ip ?? '')}`;
  },
  store: new PostgresRateLimitStore({ limiter: 'media-fetch', windowMs: FIFTEEN_MINUTES_MS }),
});

/**
 * Validation middleware
 * Checks validation results and returns errors if any
 */
export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: 'path' in err ? err.path : 'unknown',
        message: err.msg,
      })),
    });
    return;
  }
  next();
}

/**
 * Validation rules for user registration
 */
export const registerValidation: ValidationChain[] = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),

  body('password')
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters'),

  body('fullName')
    .trim()
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage('Full name is required and must not exceed 255 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes'),

  // No `role` rule. Registration does not accept a role at all (see the comment
  // on POST /api/auth/register), and validating one here would wrongly imply
  // that supplying it is a supported thing to do.
];

/**
 * Validation rules for login
 */
export const loginValidation: ValidationChain[] = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('password')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Password is required'),
];

/**
 * Validation rules for password update
 */
export const passwordUpdateValidation: ValidationChain[] = [
  body('oldPassword')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Current password is required'),

  body('newPassword')
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters'),
];

/**
 * Validation rules for user update
 */
export const userUpdateValidation: ValidationChain[] = [
  body('fullName')
    .optional()
    .trim()
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage('Full name must not exceed 255 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('role')
    .optional()
    .isIn(['admin', 'manager', 'user'])
    .withMessage('Role must be admin, manager, or user'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

/**
 * Security headers middleware
 * Adds additional security headers beyond helmet
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (formerly Feature-Policy)
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
}

/**
 * Request sanitization
 * Remove potentially dangerous characters from input
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove null bytes and control characters (except newlines/tabs)
        obj[key] = obj[key].replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
      } else if (typeof obj[key] === 'object') {
        obj[key] = sanitizeObject(obj[key]);
      }
    }

    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
}
