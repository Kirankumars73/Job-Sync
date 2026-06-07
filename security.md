# JobSync — Security Architecture

---

## Threat Model Overview

JobSync handles personally identifiable information (email, username), professional data (job applications), and social relationships (friends, groups). Attackers may be:

- **Competitors** scraping job/company data
- **Malicious users** attempting to access friends' private applications
- **Automated bots** registering fake accounts or credential stuffing
- **State-level actors** (GDPR-relevant jurisdictions)
- **Insider threats** (admin misuse)

**Security Priority**: Confidentiality > Integrity > Availability

---

## Authentication Security

### Password Hashing: Argon2id

Never store plaintext or MD5/SHA1 passwords. Use **Argon2id** (winner of Password Hashing Competition).

```
Algorithm: Argon2id
Memory:    64 MB (65536 KB)
Iterations: 3
Parallelism: 4
Salt: 16 bytes (random, per-password)
Output: 32 bytes
```

Why Argon2id over bcrypt:
- Resistant to both GPU and side-channel attacks
- Memory-hard: limits brute-force speed
- Combines Argon2i and Argon2d properties

### JWT Best Practices

```
Access Token:
  - Algorithm: RS256 (asymmetric, public key verifiable)
  - Expiry: 15 minutes
  - Payload: { sub: userId, role, jti: unique-id, iat, exp }
  - Stored: memory only (never localStorage)

Refresh Token:
  - 64-byte cryptographically random hex string
  - Stored in DB as SHA-256 hash (never raw)
  - Delivered as httpOnly, Secure, SameSite=Strict cookie
  - Expiry: 7 days
  - One active refresh token per device per user
```

### Refresh Token Rotation

Every time a refresh token is used:
1. Old token is immediately invalidated in DB.
2. A new refresh token is issued.
3. If an **already-used** refresh token is detected: **full session revocation** (all refresh tokens for that user are invalidated — token theft detected).

### Session Security

- JWT blacklist in Redis: when user logs out, JWT `jti` is stored with TTL = remaining JWT lifetime.
- All middleware checks blacklist before trusting JWT.
- Device info + IP stored with refresh token for audit.

---

## API Security

### Rate Limiting

Implemented at two levels:

**Nginx (IP-level)**:
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
limit_req zone=api burst=20 nodelay;
```

**Express middleware (user-level, Redis-backed)**:

| Endpoint | Limit | Window | Purpose |
|---|---|---|---|
| POST /auth/register | 5 | 15 min (IP) | Prevent mass account creation |
| POST /auth/login | 10 | 15 min (IP) | Brute force protection |
| POST /auth/forgot-password | 3 | 1 hour (IP) | Prevent email enumeration |
| POST /applications | 30 | 1 min (user) | Prevent data flooding |
| POST /friends/request | 20 | 1 hour (user) | Prevent spam |
| GET /feed/* | 60 | 1 min (user) | Anti-scraping |

After 5 consecutive failed logins: **exponential backoff** (1s, 2s, 4s... up to 15 min lockout).

### Request Validation

Every incoming request body is validated with Zod before any business logic runs:
- Type coercion disabled (strict types)
- Unknown keys stripped
- Max string lengths enforced
- URL fields validated with `z.string().url()`
- Enum fields reject unlisted values

### Input Sanitization

- No raw HTML rendering from user input (React escapes by default)
- DOMPurify on any admin-rendered content
- All database interactions via Prisma (parameterized queries only)
- No string interpolation in SQL

### API Abuse Prevention

- CORS: whitelist only `https://jobsync.app` and `https://www.jobsync.app`
- Content-Type enforcement: reject non-JSON bodies on JSON endpoints
- Payload size limit: 100KB max body
- Request ID on every response (for tracing, not security)

---

## Database Security

### SQL Injection Prevention

Prisma ORM generates parameterized queries 100% of the time. Raw queries are never used. All user-supplied values go through Prisma's query builder.

Example of what Prisma generates internally:
```sql
-- Developer writes:
prisma.user.findUnique({ where: { friendCode: req.body.code } })

-- Prisma executes:
SELECT * FROM users WHERE friend_code = $1  -- $1 = sanitized value
```

**Raw SQL is forbidden** in the codebase (enforced via ESLint rule against `prisma.$queryRaw`).

### ORM Security

- Prisma schema enforces column types → no type confusion attacks
- Prisma rejects queries that reference non-existent columns at compile time
- Select only required fields (never `SELECT *` in production queries)

### Database Access Control

```sql
-- Application user (limited privileges)
CREATE ROLE jobsync_app LOGIN PASSWORD '...';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jobsync_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO jobsync_app;

-- Application user cannot DROP, TRUNCATE, or ALTER
-- Migrations run via a separate migration user
```

---

## Infrastructure Security

### Nginx Reverse Proxy Hardening

```nginx
# Hide server version
server_tokens off;

# Security headers
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

# TLS configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers off;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:10m;

# HSTS
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

### Firewall Configuration

```
Inbound Rules:
  Port 443 (HTTPS) → ALLOW all
  Port 80 (HTTP) → ALLOW, redirect to 443
  Port 22 (SSH) → ALLOW from VPN/bastion only
  All other inbound → DENY

Database Server:
  Port 5432 → ALLOW from API server IPs only
  All other inbound → DENY

Redis:
  Port 6379 → ALLOW from API server IPs only
  No TLS required on private subnet (VPC)
```

### WAF Integration (AWS WAF or Cloudflare)

Rules enabled:
- OWASP Core Rule Set (CRS)
- SQL injection detection
- XSS pattern detection
- Known bad bots blocking
- Geo-blocking for high-risk regions (configurable)
- Rate limiting at CDN edge layer

### Docker Security

```dockerfile
# Run as non-root user
FROM node:20-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Read-only filesystem
# (applied at compose level)

# No privileged escalation
```

```yaml
# docker-compose.prod.yml
services:
  api:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
```

- Docker images scanned with **Trivy** in CI before deployment
- No secrets in Dockerfile or docker-compose — all via environment injection

---

## Secrets Management

### Environment Variables

```bash
# .env structure (never committed to git)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...
ARGON2_PEPPER=<random-32-byte-hex>      # Additional pepper on password hash
REFRESH_TOKEN_SECRET=<random-64-byte-hex>
EMAIL_API_KEY=...
```

### Production: AWS Secrets Manager / HashiCorp Vault

- All secrets injected at container startup via AWS Secrets Manager
- Application reads from environment — no code changes needed
- **Key rotation**: every 90 days for all secrets
- JWT RSA keypair rotation: every 6 months (with key overlap period)
- Old keys remain valid for 24 hours post-rotation to drain existing tokens

### `.gitignore` Enforcement

```
.env
.env.*
!.env.example
*.pem
*.key
```

ESLint plugin `no-process-env` warns on raw `process.env` access outside `config/env.ts`.

---

## Frontend Security

### Content Security Policy (CSP)

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{nonce}';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https://avatars.example.com;
  connect-src 'self' wss://api.jobsync.app https://api.jobsync.app;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

### XSS Prevention

- React escapes all interpolated values by default
- `dangerouslySetInnerHTML` is banned via ESLint
- Any admin-facing content rendered with DOMPurify
- Third-party scripts loaded only from trusted CDNs with SRI hashes

### CSRF Protection

- All state-mutating API calls use JSON bodies (not form-encoded)
- CORS restricts origins to `https://jobsync.app`
- Refresh token cookie: `SameSite=Strict` prevents cross-site inclusion
- Custom `X-Requested-With: XMLHttpRequest` header required on all API calls (checked server-side)

### Secure Cookies

```
Set-Cookie: jobsync_refresh=<token>; 
  HttpOnly;
  Secure;
  SameSite=Strict;
  Path=/api/auth/refresh;   ← Scoped to only the refresh endpoint
  Max-Age=604800;           ← 7 days
  Domain=api.jobsync.app
```

Scoping to `/api/auth/refresh` means the cookie is NOT sent on any other request.

---

## Penetration Testing Checklist

| Attack Vector | Defense |
|---|---|
| **SQL Injection** | Prisma ORM only; no raw SQL; Zod input validation |
| **XSS (Stored)** | React escaping; CSP; DOMPurify on admin views |
| **XSS (Reflected)** | No server-side rendering of user input; CSP nonce |
| **CSRF** | SameSite=Strict cookies; CORS whitelist; custom header |
| **SSRF** | URL input normalized; no server-side URL fetch (link health uses sandboxed worker) |
| **RCE** | No eval(); no child_process with user input; Docker with no-new-privileges |
| **IDOR** | All queries scoped to `req.user.id`; ownership verified in service layer |
| **Session Hijacking** | httpOnly cookies; Secure flag; refresh token rotation; IP+UA logging |
| **Credential Stuffing** | Rate limiting; Argon2id (slow hash); breached password check (HaveIBeenPwned API) |
| **Brute Force** | Login rate limiting (10/15min); exponential backoff; account lockout |
| **JWT Manipulation** | RS256 (asymmetric); `alg: none` rejected; blacklist on logout; short TTL |
| **Broken Access Control** | Role checks in service layer; middleware authorization; audit logging |
| **File Upload Exploits** | No file uploads in MVP; future: MIME type validation + virus scan |
| **Open Redirects** | No redirect parameters; all redirects hardcoded |
| **Clickjacking** | `X-Frame-Options: DENY`; `frame-ancestors 'none'` in CSP |
| **API Enumeration** | UUID primary keys; friend codes non-sequential; generic error messages |
| **Mass Assignment** | Zod strips unknown keys; explicit field selection in repositories |
| **Path Traversal** | No file system operations on user input |
| **Timing Attacks** | Constant-time comparison for token/hash comparison (`crypto.timingSafeEqual`) |

---

## Privacy Protection

### User Isolation

- Every database query is scoped to `userId` from JWT — never from request body
- Friend feeds require active friendship row in DB — not just knowing a user's ID
- Group feeds require active `group_members` row

### Visibility Controls

Each application has a `visibility` field:
- `private` — Only visible to owner
- `friends` — Visible to accepted friends
- `groups` — Visible to group members
- `public` — Visible to anyone in the system (future feature)

Feed queries filter on `visibility` at the SQL level (not application level).

### Data Minimization

- Friend feed only exposes: `companyName`, `role`, `canonicalUrl`, `status`, `appliedAt`
- Notes are **never** visible in feeds (private to owner)
- Email addresses are never exposed in any API response except `GET /users/me`
- Friend code is exposed only to the owner in profile view

---

## Logging & Monitoring

### Structured Logging (Winston)

```json
{
  "level": "info",
  "timestamp": "2025-01-20T10:00:00Z",
  "requestId": "uuid",
  "userId": "uuid",
  "method": "POST",
  "path": "/api/applications",
  "statusCode": 201,
  "durationMs": 45
}
```

PII (email, password) is **never logged**. Tokens are logged as hashes only.

### Audit Log Events

Every sensitive action is written to `audit_logs`:

| Action | Logged |
|---|---|
| `USER_REGISTER` | IP, user agent |
| `USER_LOGIN` | IP, user agent, success/fail |
| `USER_LOGOUT` | IP |
| `PASSWORD_RESET` | IP |
| `ADD_FRIEND` | Friend ID |
| `REMOVE_FRIEND` | Friend ID |
| `CREATE_GROUP` | Group ID |
| `JOIN_GROUP` | Group ID |
| `SAVE_APPLICATION` | Application ID |
| `DELETE_APPLICATION` | Application ID |
| `ADMIN_BAN_USER` | Target user ID, admin ID, reason |

### Security Alerts

Automated alerts on:
- 5+ failed logins from same IP in 5 minutes → Slack/PagerDuty alert
- Login from new country → Email to user
- Refresh token reuse detected → Auto-revoke all sessions + alert
- Database error rate spike → PagerDuty
- Unusual API call volume (> 10× baseline) → Slack alert

### Intrusion Detection

- AWS GuardDuty for cloud-level threat detection
- Fail2ban on EC2 instances (SSH protection)
- CloudWatch anomaly detection on API error rates

---

## Security Scorecard

| Domain | Score | Notes |
|---|---|---|
| Authentication | ★★★★★ | Argon2id, JWT RS256, refresh rotation |
| Authorization | ★★★★☆ | RBAC + ownership checks; row-level security |
| Input Validation | ★★★★★ | Zod on all inputs |
| Injection Prevention | ★★★★★ | Prisma ORM only |
| Transport Security | ★★★★★ | TLS 1.3, HSTS, HPKP |
| Frontend Security | ★★★★☆ | CSP, CSRF, XSS; no file uploads yet |
| Secrets Management | ★★★★☆ | Secrets Manager; key rotation |
| Logging & Monitoring | ★★★★☆ | Structured logs, audit trail, alerts |
| Privacy | ★★★★★ | Visibility controls, data minimization |
| GDPR Readiness | ★★★★☆ | Delete endpoint needed; export endpoint needed |

---

## Compliance

### OWASP Top 10 (2021) Coverage

| Risk | Mitigation |
|---|---|
| A01 Broken Access Control | Ownership checks, RBAC, scoped queries |
| A02 Cryptographic Failures | Argon2id, TLS 1.3, no plaintext secrets |
| A03 Injection | Prisma ORM, Zod validation |
| A04 Insecure Design | Threat-modeled design, least-privilege |
| A05 Security Misconfiguration | Nginx hardening, Docker security, CSP |
| A06 Vulnerable Components | Dependabot, monthly npm audit |
| A07 Auth & Session Failures | Refresh rotation, blacklist, httpOnly |
| A08 Software & Data Integrity | SRI hashes, signed Docker images |
| A09 Security Logging | Audit logs, structured logs, alerts |
| A10 SSRF | No server-side URL fetching in API layer |

### GDPR-Ready Architecture

- **Right to erasure**: `DELETE /users/me` — hard-deletes all user data
- **Data portability**: `GET /users/me/export` — JSON export of all data (future)
- **Consent**: Privacy policy acceptance logged at registration
- **Data minimization**: Only collect what is needed
- **Breach notification**: Monitoring pipeline → 72-hour notification capability
