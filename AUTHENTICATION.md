# Authentication & Authorization System

## Overview

This system implements **enterprise-grade authentication and authorization** following **OWASP 2025 security standards**. It includes:

- **JWT-based authentication** with access and refresh tokens
- **Role-based access control (RBAC)** with 3 roles: Admin, Manager, User
- **Secure password hashing** using bcrypt (work factor 12)
- **Rate limiting** to prevent brute force attacks
- **Token blacklisting** for instant revocation
- **Account lockout** after failed login attempts
- **HttpOnly, Secure, SameSite cookies** for refresh tokens
- **Token rotation** for enhanced security

## Security Features

### 1. Password Security
- **Bcrypt hashing** with work factor 12 (OWASP recommended minimum 10)
- **Password strength validation**:
  - Minimum 8 characters (12+ recommended)
  - Maximum 128 characters
  - Blocks common weak passwords
- **Secure password comparison** using constant-time algorithms
- **Auto-generated secure passwords** available for admin setup

### 2. JWT Security
- **Short-lived access tokens**: 15 minutes expiry
- **Long-lived refresh tokens**: 7 days expiry
- **Token rotation on refresh**: Old refresh tokens automatically revoked
- **JWT ID (jti)** for individual token tracking and revocation
- **Token family tracking** for replay attack detection
- **Secure signing** using HS256 algorithm
- **Issuer and audience validation**

### 3. Rate Limiting
- **Authentication endpoints**: 5 attempts per 15 minutes
- **General API endpoints**: 100 requests per 15 minutes
- **Per-IP tracking** for brute force protection

### 4. Account Protection
- **Failed login tracking**
- **Automatic account lockout** after 5 failed attempts
- **30-minute lockout duration**
- **Login attempt logging** with IP and user agent

### 5. Token Management
- **Refresh tokens stored as HttpOnly cookies**
- **Token blacklisting** for immediate revocation
- **Automatic token cleanup** for expired tokens
- **All sessions logout** capability

## User Roles

### Admin
- Full system access
- User management
- Can access all resources
- Can modify user roles and permissions

### Manager
- Can manage team reports
- View all reports
- Create and edit reports
- Limited admin functions

### User
- Basic access
- Can only access own resources
- Create and edit own reports
- No admin functions

### How the roles are actually enforced

Roles are checked by `authorize()` (`src/middleware/auth.middleware.ts`), applied
to every route through the three bands in `src/middleware/policy.ts`.

Almost every route is open to all three roles, and that is the design rather than
a gap: every resource the app stores — destinations, templates, scan settings —
is already per-user, filtered on `user_id` in the SQL itself. A role says what
kind of thing you may do; it cannot say whose copy of it you get. Ownership is
the boundary there, and a role band on top of it would break the product for
non-admins without adding protection.

What is genuinely admin-only is acting on other people: `/api/users` (list, role
change, deactivate, delete). Two rules apply there:

- **At least one active admin must always remain.** Demoting, deactivating or
  deleting the last one returns `409`.
- **The role comes from the database row, not the token.** A demotion or
  deactivation takes effect on the user's very next request, not at their next
  login, and their refresh tokens are revoked at the same time.

Still outstanding: `analysis_history`, `work_items` and `processed_commits` have
no `user_id`, so `GET /api/reports` and `GET /api/history` return every user's
rows to any authenticated caller. That needs a column and a migration; no role
check can substitute for it.

## Setup Instructions

### 1. Initial Setup

First, build the project:

```bash
npm run build
```

### 2. Create Admin User

Run the interactive setup script:

```bash
npm run setup-admin
```

Follow the prompts to create your first admin user. You can either:
- Provide your own secure password
- Let the system generate a random secure password

**IMPORTANT**: Save the admin credentials securely!

### 3. Environment Variables (Optional but Recommended)

Create a `.env` file in the project root:

```env
# JWT Secrets (change these in production!)
JWT_ACCESS_SECRET=your-very-long-random-string-min-32-chars-access
JWT_REFRESH_SECRET=your-very-long-random-string-min-32-chars-refresh-different-from-access

# Environment
NODE_ENV=production

# Frontend URL (for CORS)
FRONTEND_URL=https://your-production-domain.com
```

**Security Notes**:
- JWT secrets must be **at least 32 characters long**
- Access and refresh secrets **must be different**
- Use truly random strings in production
- Never commit secrets to version control

### 4. Start the Server

```bash
npm run webhook
```

The server will start on port 3009 by default.

## API Endpoints

### Authentication Endpoints (Public)

#### Register New User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "fullName": "John Doe"
}
```

Registration does **not** accept a role. It is a public, unauthenticated
endpoint, so honouring a caller-supplied role would let anyone who can reach the
port make themselves an admin. Every registration produces a `user`; a `role`
field in the body is ignored. Roles are assigned afterwards by an admin via
`PUT /api/users/:id`, or by the one-time `POST /api/auth/setup` bootstrap.

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "user",
      "is_active": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2025-01-24T10:45:00.000Z"
  }
}
```

**Note**: Refresh token is automatically set as an HttpOnly cookie.

#### Refresh Access Token
```http
POST /api/auth/refresh
Cookie: refreshToken=...

// OR in body (less secure)
Content-Type: application/json

{
  "refreshToken": "..."
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
Cookie: refreshToken=...
```

#### Logout All Sessions
```http
POST /api/auth/logout-all
Authorization: Bearer <access_token>
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

#### Update Password
```http
PUT /api/auth/password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "oldPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Note**: All sessions are automatically logged out after password change.

### Protected Endpoints

All other API endpoints now require authentication. Include the access token in the Authorization header:

```http
Authorization: Bearer <access_token>
```

Protected endpoints include:
- `/api/analyze` - Analyze git commits
- `/api/save-report` - Save reports
- `/api/reports` - Get all reports
- `/api/reports/:id` - Get single report
- `/api/notes` - Upload notes
- `/api/create-tasks` - Create ClickUp tasks

## Frontend Integration

### 1. Login Flow

```javascript
// Login
const response = await fetch('http://localhost:3009/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Important for cookies
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { data } = await response.json();

// Store access token (localStorage or state management)
localStorage.setItem('accessToken', data.accessToken);
localStorage.setItem('user', JSON.stringify(data.user));
```

### 2. Making Authenticated Requests

```javascript
const accessToken = localStorage.getItem('accessToken');

const response = await fetch('http://localhost:3009/api/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  credentials: 'include',
  body: JSON.stringify({ /* analysis params */ })
});
```

### 3. Token Refresh

```javascript
async function refreshAccessToken() {
  const response = await fetch('http://localhost:3009/api/auth/refresh', {
    method: 'POST',
    credentials: 'include' // Sends refresh token cookie
  });

  if (response.ok) {
    const { data } = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    return data.accessToken;
  } else {
    // Refresh failed - redirect to login
    localStorage.clear();
    window.location.href = '/login';
  }
}
```

### 4. Automatic Token Refresh

Implement an interceptor to automatically refresh tokens on 401 errors:

```javascript
async function apiCall(url, options) {
  let token = localStorage.getItem('accessToken');

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    },
    credentials: 'include'
  });

  // If 401, try refreshing token
  if (response.status === 401) {
    token = await refreshAccessToken();

    // Retry original request with new token
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include'
    });
  }

  return response;
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'user')),
  is_active INTEGER NOT NULL DEFAULT 1,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);
```

### Refresh Tokens Table
```sql
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  user_agent TEXT,
  ip_address TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Token Blacklist Table
```sql
CREATE TABLE token_blacklist (
  jti TEXT PRIMARY KEY,
  token_type TEXT NOT NULL CHECK(token_type IN ('access', 'refresh')),
  expires_at TEXT NOT NULL,
  blacklisted_at TEXT NOT NULL,
  reason TEXT
);
```

### Login Attempts Table
```sql
CREATE TABLE login_attempts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  success INTEGER NOT NULL,
  attempted_at TEXT NOT NULL,
  failure_reason TEXT
);
```

## Security Best Practices

### Production Deployment

1. **Always use HTTPS** in production
2. **Set strong JWT secrets** (minimum 32 characters, randomly generated)
3. **Enable secure cookies** (`secure: true` in production)
4. **Configure CORS properly** (whitelist only your frontend domain)
5. **Use environment variables** for all secrets
6. **Enable rate limiting** on all endpoints
7. **Regular security audits**
8. **Keep dependencies updated**

### Password Policy

- Minimum 8 characters (recommend 12+)
- No maximum length restrictions (up to 128 chars)
- Allow all characters including unicode
- Block common weak passwords
- Encourage passphrases over complex passwords

### Token Management

- Access tokens expire after 15 minutes
- Refresh tokens expire after 7 days
- Implement token rotation (done automatically)
- Clear tokens on logout
- Revoke all tokens on password change

## Troubleshooting

### "JWT_ACCESS_SECRET not set in environment variables"

Set JWT secrets in `.env` file or the warnings will appear (defaults are used but not secure).

### "Too many login attempts"

Account is temporarily locked after 5 failed attempts. Wait 30 minutes or contact an admin.

### "Invalid or expired token"

Access token has expired. Use the refresh endpoint to get a new access token.

### "Token reuse detected"

Security feature - someone tried to reuse an old refresh token. All sessions have been revoked for security.

## Support

For issues or questions:
- Check the logs in the console
- Review the authentication middleware
- Check database permissions
- Ensure all environment variables are set correctly

## License

MIT License - See LICENSE file for details.
