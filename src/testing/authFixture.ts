/**
 * Test fixture: a bearer token backed by a real user row.
 *
 * `authenticate` re-reads the user on every request (see `resolveIdentity` in
 * src/middleware/auth.middleware.ts), so a token minted straight from
 * JWTService for an id that exists in no users table is correctly rejected with
 * 401. Route tests therefore need an actual row, not just a signature.
 *
 * The row is written through AuthDatabaseService, which resolves its file from
 * `process.cwd()` — so call this AFTER the suite has chdir'd into its temp
 * directory, or it will write into the real `.database/`.
 */
import { AuthDatabaseService } from "../services/AuthDatabaseService.js";
import { JWTService } from "../services/JWTService.js";

export interface TestUserOptions {
  userId?: string;
  email?: string;
  role?: "admin" | "manager" | "user";
  fullName?: string;
  isActive?: boolean;
}

export interface TestUser {
  userId: string;
  email: string;
  role: "admin" | "manager" | "user";
  accessToken: string;
  authHeader: string;
}

/** Creates a user row in the cwd's auth database and returns a usable token. */
export function createTestUser(options: TestUserOptions = {}): TestUser {
  const userId = options.userId ?? "user-1";
  const email = options.email ?? `${userId}@example.com`;
  const role = options.role ?? "user";
  const fullName = options.fullName ?? "Test User";

  const db = new AuthDatabaseService();
  try {
    if (!db.getUserById(userId)) {
      db.createUser({
        id: userId,
        email,
        // Never used: these tokens are minted directly, never logged in with.
        // A syntactically valid argon2 hash placeholder keeps the column honest.
        password_hash: "$argon2id$v=19$m=65536,t=3,p=4$notarealhash$notarealhash",
        full_name: fullName,
        role,
        is_active: options.isActive ?? true,
        email_verified: true,
      });
    }
  } finally {
    db.close();
  }

  const { accessToken } = JWTService.generateTokenPair({
    userId,
    email,
    role,
    fullName,
  });

  return { userId, email, role, accessToken, authHeader: `Bearer ${accessToken}` };
}
