# JobSync — System Architecture

---

## Recommended Tech Stack

### Frontend
| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 14** (App Router) | SSR for SEO, RSC, file-based routing, API routes |
| Language | **TypeScript** | Type safety, better DX |
| Styling | **Tailwind CSS** | Utility-first, consistent design system |
| State | **Zustand** + **React Query (TanStack)** | Lightweight global state + server state sync |
| Real-time | **Socket.IO client** | WebSocket for live feed updates |
| Forms | **React Hook Form + Zod** | Validation + type-safe schemas |

### Backend
| Layer | Choice | Reason |
|---|---|---|
| Runtime | **Node.js 20 LTS** | Async I/O, large ecosystem |
| Framework | **Express.js** | Minimal, flexible, battle-tested |
| Language | **TypeScript** | Consistent with frontend |
| ORM | **Prisma** | Type-safe queries, migration management |
| WebSocket | **Socket.IO** | Rooms, namespaces, fallback transport |
| Queue | **BullMQ** (Redis-backed) | Async jobs: notifications, fingerprinting |
| Validation | **Zod** | Schema validation, shared with frontend |

### Database
| Layer | Choice | Reason |
|---|---|---|
| Primary DB | **PostgreSQL 16** | ACID, complex queries, JSON support |
| Cache | **Redis 7** | Feed caching, session store, pub/sub |
| Search (future) | **Elasticsearch** | Job search and recommendations |

### Authentication
| Layer | Choice |
|---|---|
| Password Hashing | **Argon2id** |
| Tokens | **JWT (Access) + Refresh Token (DB-stored)** |
| Sessions | **Stateless JWT + Redis blacklist** |

### Infrastructure
| Layer | Choice |
|---|---|
| Containerization | **Docker + Docker Compose** |
| Reverse Proxy | **Nginx** |
| CI/CD | **GitHub Actions** |
| Cloud | **AWS** (ECS Fargate + RDS + ElastiCache) |
| CDN | **CloudFront** |
| Object Storage | **S3** (future: avatars, exports) |

---

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                            CLIENTS                                   │
│           Web Browser          │        Mobile App (future)          │
└──────────────┬─────────────────┴──────────────────────┬─────────────┘
               │  HTTPS                                  │ HTTPS
               ▼                                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        CLOUDFRONT CDN                                 │
│            Static assets, Next.js ISR pages, image cache              │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       NGINX REVERSE PROXY                             │
│         TLS termination │ Rate limiting │ Request routing             │
└────────┬───────────────────────────────────────────┬─────────────────┘
         │                                           │
         ▼                                           ▼
┌─────────────────┐                      ┌─────────────────────────┐
│  Next.js Server │                      │   Express.js API Server  │
│  (SSR + Static) │                      │   (REST + WebSocket)     │
│   Port 3000     │                      │   Port 4000              │
└─────────────────┘                      └──────────┬──────────────┘
                                                    │
                    ┌───────────────────────────────┼────────────────┐
                    │                               │                │
                    ▼                               ▼                ▼
          ┌──────────────────┐          ┌─────────────────┐  ┌──────────────┐
          │   PostgreSQL 16   │          │    Redis 7       │  │  BullMQ      │
          │   Primary DB      │          │  Cache + Pub/Sub │  │  Job Queues  │
          │   Port 5432       │          │  Port 6379       │  │  (Workers)   │
          └──────────────────┘          └─────────────────┘  └──────────────┘
```

---

## Request Flow

```
Client Request
     │
     ▼
CloudFront (CDN cache check)
     │ cache miss
     ▼
Nginx (TLS terminate, rate limit check)
     │
     ├── /api/* ──────────────────► Express.js API
     │                                    │
     │                               JWT Middleware
     │                                    │
     │                              Route Handler
     │                                    │
     │                         ┌──────────┴──────────┐
     │                         ▼                     ▼
     │                     PostgreSQL              Redis
     │                    (primary query)        (cache hit)
     │                         │
     │                    Response ◄────────────────┘
     │
     └── /* ───────────────────► Next.js Server (SSR/Static)
```

---

## Authentication Flow

```
REGISTER:
  Client → POST /api/auth/register
        → Validate input (Zod)
        → Check username uniqueness
        → Hash password (Argon2id)
        → Generate friend code (nanoid + collision check)
        → INSERT user row
        → Generate JWT (15min) + Refresh Token (7d)
        → Store refresh token hash in DB
        → Return tokens + user profile

LOGIN:
  Client → POST /api/auth/login
        → Validate input
        → Fetch user by username
        → Verify Argon2id hash
        → Rotate refresh token
        → Return new JWT + Refresh Token (httpOnly cookie)

TOKEN REFRESH:
  Client → POST /api/auth/refresh
        → Read refresh token from httpOnly cookie
        → Verify token signature
        → Check token hash in DB (not revoked)
        → Issue new JWT + rotate refresh token

LOGOUT:
  Client → POST /api/auth/logout
        → Invalidate refresh token in DB
        → Blacklist JWT in Redis (TTL = remaining JWT lifetime)
        → Clear httpOnly cookie
```

---

## Friend System Flow

```
ADD FRIEND:
  User A → POST /api/friends/request { friendCode: "ABX9-KLQ7-8P21" }
         → Resolve friend code to User B ID
         → Check: not self, not already friends, no pending request
         → INSERT friend_requests row (status: pending)
         → Emit notification to User B (Socket.IO)

ACCEPT:
  User B → PUT /api/friends/request/:id/accept
         → Update friend_requests status → accepted
         → INSERT friendships (bidirectional: A→B and B→A)
         → Notify User A

REJECT:
  User B → PUT /api/friends/request/:id/reject
         → Update status → rejected

VIEW FRIEND FEED:
  User A → GET /api/friends/:id/feed
         → Verify friendship exists
         → SELECT jobs WHERE user_id = B AND canonical_hash NOT IN
           (SELECT canonical_hash FROM applications WHERE user_id = A)
         → Apply visibility filter (friends_only or public)
         → Return filtered feed
```

---

## Group System Flow

```
CREATE GROUP:
  User → POST /api/groups { name, description }
       → Generate unique group code (e.g. GROUP-X92KLQ)
       → INSERT groups row (owner = current user)
       → INSERT group_members row (user = owner, role = owner)
       → Return group with code

JOIN GROUP:
  User → POST /api/groups/join { groupCode: "GROUP-X92KLQ" }
       → Resolve code to group
       → Check: not already member
       → INSERT group_members (role = member)

GROUP FEED:
  User → GET /api/groups/:id/feed
       → Verify membership
       → SELECT DISTINCT jobs FROM applications
         WHERE user_id IN (group members)
         AND canonical_hash NOT IN (current user's canonical hashes)
         AND visibility IN ('group', 'public')
       → Return aggregated filtered feed
```

---

## Job Tracking Flow

```
SAVE JOB:
  User → POST /api/applications
       → Normalize URL (strip UTM/tracking params)
       → Generate canonical hash (SHA-256 of normalized URL)
       → Check: canonical_hash NOT already in user's applications
       → If duplicate: return 409 Conflict
       → INSERT application row
       → Publish event to BullMQ (notify friends/groups)

NOTIFICATION WORKER (async):
  BullMQ → Fetch user's friends and group members
         → For each potential recipient:
             Check if canonical_hash is in their applications
             If NOT: INSERT notification row
                     Emit Socket.IO event to recipient
```

---

## Notification Flow

```
Server-Side:
  Application saved
       │
       ▼
  BullMQ notification job
       │
       ▼
  Worker: fetch all friends of user
       │
       ▼
  For each friend:
    → Check if job is in friend's applications (Redis cache first)
    → If not: INSERT notification (type: new_job_from_friend)
              Emit via Socket.IO to friend's socket room
       │
       ▼
  Client receives real-time event
  → Badge count incremented
  → Feed updates (React Query invalidation)
```

---

## Scalability Design

### Horizontal Scaling

- **API Servers**: Stateless Express.js instances behind Nginx upstream load balancer. Can scale to N replicas.
- **WebSocket**: Socket.IO with Redis adapter for pub/sub across multiple server instances.
- **Worker Nodes**: BullMQ workers run independently; scale based on queue depth.
- **Database**: PostgreSQL read replicas for read-heavy feed queries. Primary for writes only.
- **Redis**: Redis Cluster for horizontal cache scaling.

```
                  Load Balancer (Nginx / AWS ALB)
                       │
          ┌────────────┼───────────────┐
          ▼            ▼               ▼
    API Instance 1  API Instance 2  API Instance 3
          │            │               │
          └────────────┴───────────────┘
                       │
              Redis Adapter (Socket.IO)
                       │
              ┌────────┴────────┐
              ▼                 ▼
         Redis Primary    Redis Replica
```

### Database Indexing Strategy

```sql
-- High-traffic query: duplicate detection
CREATE INDEX idx_applications_user_hash ON applications(user_id, canonical_hash);

-- Friend feed query
CREATE INDEX idx_applications_user_created ON applications(user_id, created_at DESC);

-- Friend lookup
CREATE INDEX idx_friendships_user_friend ON friendships(user_id, friend_id);

-- Group member lookup
CREATE INDEX idx_group_members_group ON group_members(group_id, user_id);

-- Notification retrieval
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);

-- Friend code lookup
CREATE UNIQUE INDEX idx_users_friend_code ON users(friend_code);
```

### Caching Strategy

| Data | Cache Key | TTL | Invalidation |
|---|---|---|---|
| Friend feed | `feed:friend:{userId}:{friendId}` | 5 min | On new application by friend |
| Group feed | `feed:group:{userId}:{groupId}` | 5 min | On new application in group |
| User profile | `user:{userId}` | 10 min | On profile update |
| Group members | `group:members:{groupId}` | 10 min | On member join/leave |
| Notification count | `notif:unread:{userId}` | Real-time | On read/new notification |
| Application hash set | `user:hashes:{userId}` | 30 min | On new application |

### CDN Strategy

- Next.js static pages and assets served from CloudFront edge.
- Cache-Control headers set per content type.
- API requests bypass CDN entirely (dynamic).
- Profile images (future) served from S3 + CloudFront with long TTLs.

### Rate Limiting

| Endpoint | Limit | Window |
|---|---|---|
| POST /auth/register | 5 req | 15 min per IP |
| POST /auth/login | 10 req | 15 min per IP |
| POST /applications | 30 req | 1 min per user |
| GET /feed/* | 60 req | 1 min per user |
| POST /friends/request | 20 req | 1 hour per user |
| Global API | 200 req | 1 min per user |

Rate limiting implemented at **Nginx** level (leaky bucket) and **Express middleware** (express-rate-limit + Redis store).
