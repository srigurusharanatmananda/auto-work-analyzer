/**
 * The authorisation policy, in one place.
 *
 * `authorize()` has existed and been correct since the auth work landed, but it
 * was applied to no routes at all. Rather than scatter role literals across six
 * routers, the three role sets live here so the policy can be read as a whole.
 *
 * The bands follow AUTHENTICATION.md:
 *
 *   admin    full access, including user management
 *   manager  shared configuration and team-wide reads
 *   user     their own work
 *
 * **Almost every existing route is `anyRole`, and that is the correct answer
 * rather than a gap.** Every resource this application stores is already
 * per-user: `DestinationStore`, `TemplateStore` and `ScanRegistry` all take a
 * `userId` and filter on `user_id` in the SQL itself, so a caller can only ever
 * reach their own rows. Templates additionally expose the built-ins, which have
 * `user_id NULL` and are meant to be visible to everyone.
 *
 * Gating those behind a role would not make them safer — it would break the
 * product for non-admins while leaving the actual boundary (ownership) exactly
 * where it already is. A role says *what kind of thing* you may do; it cannot
 * say *whose copy of it* you get, and conflating the two produces a permission
 * model that looks strict and protects nothing.
 *
 * So `anyRole` is applied deliberately and explicitly, not omitted: a route
 * carrying no authorize() should read as an oversight, and one carrying
 * `anyRole` as a decision that ownership is the boundary that matters there.
 *
 * What is genuinely privileged is acting on *other people*: listing users,
 * changing a role, deactivating or deleting an account. That is `adminOnly`,
 * and it is the whole of it today.
 *
 * Not solved here: `analysis_history`, `work_items` and `processed_commits` have
 * no `user_id` at all, so `GET /api/reports` and `/api/history` return every
 * user's rows to any authenticated caller. No role check can fix that — it needs
 * the column and a migration, and is tracked separately.
 */
import { authorize } from './auth.middleware.js';

/**
 * Any signed-in account. The resource itself is owner-scoped in the store, so
 * authentication plus that scoping is the complete check.
 */
export const anyRole = authorize('admin', 'manager', 'user');

/** Shared configuration and team-wide reads. Nothing uses this band yet. */
export const managerOrAdmin = authorize('admin', 'manager');

/** Acting on other users: listing, role changes, deactivation, deletion. */
export const adminOnly = authorize('admin');
