/**
 * Admin user management.
 *
 * `AuthDatabaseService` has had getAllUsers / updateUser / deleteUser since the
 * auth work landed, with no HTTP caller — so roles could be read from a token
 * but never assigned, and an account could never be deactivated. This is that
 * surface, and it is the only part of the API that is genuinely admin-only:
 * every other resource is per-user and bounded by ownership, not by role.
 *
 * Three invariants are enforced here rather than left to the caller:
 *
 *  - **`password_hash` never leaves this module.** Every response goes through
 *    `publicView`, which drops it by construction rather than by remembering to.
 *  - **At least one active admin must always remain.** Demoting, deactivating
 *    or deleting the last one would leave an installation with nobody able to
 *    administer it and no way back short of editing the database by hand.
 *
 * That second rule is deliberately the *only* lockout rule. An earlier draft
 * also forbade admins from acting on their own account, which sounds prudent
 * and is not: it makes the count check unreachable (an acting admin is by
 * definition an active admin, so a different target can never be the last one),
 * while blocking the legitimate case of an admin standing down after promoting
 * a successor. One invariant, checked where it actually matters.
 *
 * Changing your own password is not here; it lives at PUT /api/auth/password.
 */
import { Router, Request, Response } from 'express';
import { AuthDatabaseService, UserRecord } from '../services/AuthDatabaseService.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { adminOnly } from '../middleware/policy.js';
import { sanitizeInput } from '../middleware/security.middleware.js';

const ROLES = ['admin', 'manager', 'user'] as const;
type Role = (typeof ROLES)[number];

/** The shape of a user as seen over HTTP. Excludes password_hash by omission. */
function publicView(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    isActive: user.is_active,
    emailVerified: user.email_verified,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    lastLoginAt: user.last_login_at,
  };
}

export function createUsersRouter(dbFactory: () => AuthDatabaseService = () => new AuthDatabaseService()): Router {
  const router = Router();

  router.use(sanitizeInput);
  router.use(authenticate, adminOnly);

  /**
   * Runs `fn` against a fresh store and always closes it. Every handler needs
   * this and none of them should have to remember the finally block.
   */
  const withDb = <T>(fn: (db: AuthDatabaseService) => T): T => {
    const db = dbFactory();
    try {
      return fn(db);
    } finally {
      db.close();
    }
  };

  /**
   * Would this change leave the installation with no active admin? Counting
   * rather than special-casing "is this user an admin" catches the case that
   * matters: two admins where one is already deactivated.
   */
  const isLastActiveAdmin = (db: AuthDatabaseService, userId: string): boolean => {
    const admins = db
      .getAllUsers(1000, 0)
      .filter((u) => u.role === 'admin' && u.is_active);
    return admins.length <= 1 && admins.some((u) => u.id === userId);
  };

  /** GET /api/users — paginated list. */
  router.get('/', (req: Request, res: Response) => {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

    const users = withDb((db) => db.getAllUsers(limit, offset).map(publicView));
    res.json({ success: true, data: { users, limit, offset } });
  });

  /** GET /api/users/:id */
  router.get('/:id', (req: Request, res: Response) => {
    const user = withDb((db) => db.getUserById(req.params.id));
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: { user: publicView(user) } });
  });

  /**
   * PUT /api/users/:id — role, active flag and full name.
   *
   * One route rather than three, because the invariants are shared: every one of
   * these fields can lock the installation out if applied to the last admin.
   */
  router.put('/:id', (req: Request, res: Response) => {
    const targetId = req.params.id;

    const { role, isActive, fullName } = req.body as {
      role?: unknown;
      isActive?: unknown;
      fullName?: unknown;
    };

    const updates: Parameters<AuthDatabaseService['updateUser']>[1] = {};

    if (role !== undefined) {
      if (typeof role !== 'string' || !ROLES.includes(role as Role)) {
        res.status(400).json({ success: false, error: 'Role must be admin, manager, or user' });
        return;
      }
      updates.role = role as Role;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        res.status(400).json({ success: false, error: 'isActive must be a boolean' });
        return;
      }
      updates.is_active = isActive;
    }

    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || fullName.trim().length === 0 || fullName.length > 255) {
        res.status(400).json({ success: false, error: 'fullName must be 1-255 characters' });
        return;
      }
      updates.full_name = fullName.trim();
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'Nothing to update' });
      return;
    }

    const outcome = withDb((db) => {
      const user = db.getUserById(targetId);
      if (!user) return { status: 404 as const, error: 'User not found' };

      const losesAdmin =
        (updates.role !== undefined && updates.role !== 'admin') || updates.is_active === false;

      if (losesAdmin && isLastActiveAdmin(db, targetId)) {
        return {
          status: 409 as const,
          error: 'This is the last active admin; promote another admin first',
        };
      }

      db.updateUser(targetId, updates);

      // A deactivated or demoted user must not keep a 7-day refresh token.
      // `authenticate` and `refreshToken` both re-check the row, so this is
      // belt-and-braces rather than the only defence — but leaving live tokens
      // behind for an account you have just revoked is not a state to be in.
      if (updates.is_active === false || updates.role !== undefined) {
        db.revokeAllUserTokens(targetId);
      }

      return { status: 200 as const, user: db.getUserById(targetId)! };
    });

    if (outcome.status !== 200) {
      res.status(outcome.status).json({ success: false, error: outcome.error });
      return;
    }

    res.json({ success: true, data: { user: publicView(outcome.user) } });
  });

  /** DELETE /api/users/:id */
  router.delete('/:id', (req: Request, res: Response) => {
    const targetId = req.params.id;

    const outcome = withDb((db) => {
      const user = db.getUserById(targetId);
      if (!user) return { status: 404 as const, error: 'User not found' };

      if (isLastActiveAdmin(db, targetId)) {
        return {
          status: 409 as const,
          error: 'This is the last active admin; promote another admin first',
        };
      }

      db.revokeAllUserTokens(targetId);
      db.deleteUser(targetId);
      return { status: 200 as const };
    });

    if (outcome.status !== 200) {
      res.status(outcome.status).json({ success: false, error: outcome.error });
      return;
    }

    res.json({ success: true, message: 'User deleted' });
  });

  return router;
}

export default createUsersRouter;
