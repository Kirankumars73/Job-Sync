# JobSync — Database Design

---

## Overview

**Database**: PostgreSQL 16  
**ORM**: Prisma  
**Strategy**: Normalized relational schema with strategic denormalization for feed queries.

---

## Schema: Users

```sql
CREATE TABLE users (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50)   NOT NULL UNIQUE,
  email         VARCHAR(255)  UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  friend_code   VARCHAR(14)   NOT NULL UNIQUE,  -- e.g. ABX9-KLQ7-8P21
  email_verified BOOLEAN      DEFAULT FALSE,
  is_active     BOOLEAN       DEFAULT TRUE,
  is_banned     BOOLEAN       DEFAULT FALSE,
  avatar_url    VARCHAR(500),
  bio           VARCHAR(300),
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_users_username     ON users(username);
CREATE UNIQUE INDEX idx_users_email        ON users(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_users_friend_code  ON users(friend_code);
CREATE INDEX        idx_users_created_at   ON users(created_at);
```

**Notes**:
- `id` is UUID to prevent enumeration attacks.
- `friend_code` is generated using nanoid with a collision check. Format: `XXXX-XXXX-XXXX`.
- `password_hash` always stores Argon2id hash — never plaintext.
- Soft deletion via `is_active` flag.

---

## Schema: Refresh Tokens

```sql
CREATE TABLE refresh_tokens (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    VARCHAR(64)   NOT NULL UNIQUE,  -- SHA-256 of the actual token
  device_info   VARCHAR(255),                   -- optional: browser/OS info
  ip_address    INET,
  expires_at    TIMESTAMPTZ   NOT NULL,
  revoked       BOOLEAN       DEFAULT FALSE,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user     ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash     ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires  ON refresh_tokens(expires_at)
  WHERE revoked = FALSE;
```

---

## Schema: Email Verifications

```sql
CREATE TABLE email_verifications (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64)   NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ   NOT NULL,
  used        BOOLEAN       DEFAULT FALSE,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);
```

---

## Schema: Password Resets

```sql
CREATE TABLE password_resets (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64)   NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ   NOT NULL,
  used        BOOLEAN       DEFAULT FALSE,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);
```

---

## Schema: Friend Requests

```sql
CREATE TYPE friend_request_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');

CREATE TABLE friend_requests (
  id            UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     UUID                  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id   UUID                  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        friend_request_status DEFAULT 'pending',
  created_at    TIMESTAMPTZ           DEFAULT NOW(),
  updated_at    TIMESTAMPTZ           DEFAULT NOW(),

  CONSTRAINT chk_no_self_request CHECK (sender_id <> receiver_id),
  CONSTRAINT uq_friend_request UNIQUE (sender_id, receiver_id)
);

CREATE INDEX idx_friend_requests_receiver ON friend_requests(receiver_id, status);
CREATE INDEX idx_friend_requests_sender   ON friend_requests(sender_id, status);
```

---

## Schema: Friendships

```sql
CREATE TABLE friendships (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_no_self_friendship CHECK (user_id <> friend_id),
  CONSTRAINT uq_friendship UNIQUE (user_id, friend_id)
);

-- Bidirectional: both (A→B) and (B→A) are stored
CREATE INDEX idx_friendships_user   ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);
```

**Note**: When User A and User B become friends, TWO rows are inserted:
- `(user_id=A, friend_id=B)`
- `(user_id=B, friend_id=A)`

This makes the `GET /friends` query a simple `WHERE user_id = :me` without UNION.

---

## Schema: Groups

```sql
CREATE TABLE groups (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100)  NOT NULL,
  description   VARCHAR(500),
  group_code    VARCHAR(14)   NOT NULL UNIQUE,  -- e.g. GROUP-X92KLQ
  owner_id      UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_active     BOOLEAN       DEFAULT TRUE,
  max_members   INTEGER       DEFAULT 200,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_groups_code    ON groups(group_code);
CREATE INDEX        idx_groups_owner   ON groups(owner_id);
```

---

## Schema: Group Members

```sql
CREATE TYPE group_member_role AS ENUM ('owner', 'moderator', 'member');

CREATE TABLE group_members (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID              NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        group_member_role DEFAULT 'member',
  joined_at   TIMESTAMPTZ       DEFAULT NOW(),

  CONSTRAINT uq_group_member UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_group  ON group_members(group_id);
CREATE INDEX idx_group_members_user   ON group_members(user_id);
```

---

## Schema: Job Applications

```sql
CREATE TYPE application_status AS ENUM (
  'applied',
  'oa_received',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
  'no_response'
);

CREATE TYPE visibility_level AS ENUM (
  'private',
  'friends',
  'groups',
  'public'
);

CREATE TABLE applications (
  id              UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Raw input
  raw_url         TEXT               NOT NULL,
  
  -- Normalized data
  canonical_url   TEXT               NOT NULL,
  canonical_hash  VARCHAR(64)        NOT NULL,   -- SHA-256 of canonical_url
  
  -- Job metadata
  company_name    VARCHAR(255),
  role            VARCHAR(255),
  job_location    VARCHAR(255),
  
  -- Application metadata
  applied_at      DATE               DEFAULT CURRENT_DATE,
  status          application_status DEFAULT 'applied',
  notes           TEXT,
  visibility      visibility_level   DEFAULT 'friends',
  
  -- Link health
  link_active     BOOLEAN            DEFAULT TRUE,
  link_checked_at TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ        DEFAULT NOW(),
  updated_at      TIMESTAMPTZ        DEFAULT NOW(),

  CONSTRAINT uq_user_job UNIQUE (user_id, canonical_hash)
);

-- Critical: duplicate detection
CREATE UNIQUE INDEX idx_applications_user_hash
  ON applications(user_id, canonical_hash);

-- Feed queries (friend feed, group feed)
CREATE INDEX idx_applications_user_created
  ON applications(user_id, created_at DESC);

-- Visibility-filtered feed queries
CREATE INDEX idx_applications_visibility
  ON applications(user_id, visibility, created_at DESC);

-- Status filter
CREATE INDEX idx_applications_status
  ON applications(user_id, status);
```

---

## Schema: Notifications

```sql
CREATE TYPE notification_type AS ENUM (
  'friend_request_received',
  'friend_request_accepted',
  'new_job_from_friend',
  'new_job_in_group',
  'group_invite',
  'group_member_joined',
  'system_announcement'
);

CREATE TABLE notifications (
  id            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id     UUID              REFERENCES users(id) ON DELETE SET NULL,
  type          notification_type NOT NULL,
  
  -- Polymorphic reference to relevant entity
  entity_type   VARCHAR(50),      -- 'application', 'group', 'friend_request'
  entity_id     UUID,
  
  -- Human-readable message
  message       VARCHAR(500),
  
  is_read       BOOLEAN           DEFAULT FALSE,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ       DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient
  ON notifications(recipient_id, is_read, created_at DESC);

CREATE INDEX idx_notifications_unread
  ON notifications(recipient_id, created_at DESC)
  WHERE is_read = FALSE;
```

---

## Schema: Audit Logs

```sql
CREATE TABLE audit_logs (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100)  NOT NULL,   -- e.g. 'LOGIN', 'ADD_FRIEND', 'SAVE_JOB'
  entity_type VARCHAR(50),              -- 'user', 'application', 'group'
  entity_id   UUID,
  ip_address  INET,
  user_agent  VARCHAR(500),
  metadata    JSONB,                    -- extra context (old/new values)
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user    ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action  ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Partition by month for large-scale deployments
-- PARTITION BY RANGE (created_at)
```

---

## ER Diagram

```
┌──────────────┐        ┌──────────────────┐        ┌────────────────┐
│    users     │        │  friend_requests  │        │  friendships   │
│──────────────│        │──────────────────│        │────────────────│
│ id (PK)      │◄──────►│ sender_id (FK)   │        │ user_id (FK)   │
│ username     │        │ receiver_id (FK) │        │ friend_id (FK) │
│ email        │        │ status           │        │ created_at     │
│ password_hash│        └──────────────────┘        └────────────────┘
│ friend_code  │
│ ...          │        ┌──────────────────┐        ┌────────────────┐
└──────┬───────┘        │     groups        │        │ group_members  │
       │                │──────────────────│        │────────────────│
       │                │ id (PK)          │◄──────►│ group_id (FK)  │
       │                │ name             │        │ user_id (FK)   │
       │                │ group_code       │        │ role           │
       │                │ owner_id (FK)────┼────────┤ joined_at      │
       │                │ ...              │        └────────────────┘
       │                └──────────────────┘
       │
       │                ┌──────────────────┐        ┌────────────────┐
       └───────────────►│  applications    │        │ notifications  │
                        │──────────────────│        │────────────────│
                        │ id (PK)          │        │ id (PK)        │
                        │ user_id (FK)     │        │ recipient_id   │
                        │ raw_url          │        │ sender_id      │
                        │ canonical_url    │        │ type           │
                        │ canonical_hash   │        │ entity_type    │
                        │ company_name     │        │ entity_id      │
                        │ role             │        │ is_read        │
                        │ status           │        │ created_at     │
                        │ visibility       │        └────────────────┘
                        │ ...              │
                        └──────────────────┘
```

---

## URL Normalization & Canonical Hash Logic

The duplicate detection system uses the following pipeline:

```
Input URL: https://company.com/job/123?utm_source=linkedin&ref=xyz#section

Step 1: Parse URL
  → Protocol: https
  → Host: company.com
  → Path: /job/123
  → Query params: { utm_source, ref }

Step 2: Remove tracking params
  Blocked prefixes/params: utm_*, ref, source, fbclid, gclid, mc_*, 
                           _ga, _gl, yclid, msclkid, campaign

Step 3: Sort remaining query params alphabetically
  → company.com/job/123 (no remaining params)

Step 4: Remove fragment (#section)

Step 5: Lowercase host, normalize path
  → https://company.com/job/123

Step 6: Remove trailing slash (unless root)
  → Canonical URL: https://company.com/job/123

Step 7: SHA-256(canonical_url)
  → canonical_hash: a3f4b2... (64-char hex)
```

This means all of these are treated as the **same job**:
- `https://company.com/job/123`
- `https://company.com/job/123?utm_source=linkedin`
- `https://COMPANY.COM/job/123?utm=abc&ref=friend`
- `https://company.com/job/123#apply-section`

---

## Key Queries

### Friend Feed (optimized)

```sql
SELECT a.*
FROM applications a
WHERE a.user_id = :friend_id
  AND a.visibility IN ('friends', 'public')
  AND a.canonical_hash NOT IN (
    SELECT canonical_hash
    FROM applications
    WHERE user_id = :current_user_id
  )
ORDER BY a.created_at DESC
LIMIT 20 OFFSET :offset;
```

**Optimization**: Use Redis to cache the current user's canonical hash set (`SMEMBERS user:hashes:{userId}`) so the subquery is replaced by an in-memory set difference on the application layer.

### Group Feed (optimized)

```sql
SELECT DISTINCT ON (a.canonical_hash) a.*
FROM applications a
JOIN group_members gm ON gm.user_id = a.user_id
WHERE gm.group_id = :group_id
  AND a.user_id != :current_user_id
  AND a.visibility IN ('groups', 'public')
  AND a.canonical_hash NOT IN (
    SELECT canonical_hash
    FROM applications
    WHERE user_id = :current_user_id
  )
ORDER BY a.canonical_hash, a.created_at DESC
LIMIT 20 OFFSET :offset;
```

### Duplicate Check (fast path)

```sql
SELECT EXISTS (
  SELECT 1 FROM applications
  WHERE user_id = :user_id AND canonical_hash = :hash
) AS is_duplicate;
```

This single-row lookup hits `idx_applications_user_hash` (unique index) in O(log n).

---

## Query Optimization Strategy

| Pattern | Optimization |
|---|---|
| Duplicate detection | Unique composite index `(user_id, canonical_hash)` |
| Feed queries | Cover index on `(user_id, visibility, created_at DESC)` |
| Notification fetch | Partial index `WHERE is_read = FALSE` |
| Friend list | Bidirectional friendships table (simple `WHERE user_id = ?`) |
| Group membership check | Unique index `(group_id, user_id)` |
| User hash set | Redis `SADD` / `SMEMBERS` keyed by userId for O(1) set lookups |
| Large audit logs | Monthly partitioning by `created_at` |
| Pagination | Keyset pagination (cursor-based) instead of OFFSET for deep pages |

---

## Database Maintenance

```sql
-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- (Repeat for applications, groups tables)

-- Periodic cleanup of expired tokens
DELETE FROM refresh_tokens WHERE expires_at < NOW();
DELETE FROM email_verifications WHERE expires_at < NOW();
DELETE FROM password_resets WHERE expires_at < NOW();
```
