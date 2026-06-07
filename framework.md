# JobSync — Framework & Project Structure

---

## Repository Strategy

JobSync uses a **monorepo** structure managed with `pnpm workspaces`. This keeps the frontend, backend, and shared packages in one repository while allowing independent deployment.

```
jobsync/
├── apps/
│   ├── web/              ← Next.js 14 frontend
│   └── api/              ← Express.js backend
├── packages/
│   ├── shared/           ← Shared Zod schemas, types, utils
│   └── config/           ← Shared ESLint, TypeScript configs
├── docker/
│   ├── nginx.conf
│   ├── docker-compose.yml
│   └── docker-compose.prod.yml
├── .github/
│   └── workflows/
├── package.json          ← Root workspace config
└── pnpm-workspace.yaml
```

---

## Backend Project Structure (`apps/api/`)

```
apps/api/
├── src/
│   ├── server.ts                 ← Express app factory
│   ├── index.ts                  ← Entry point (listen)
│   │
│   ├── config/
│   │   ├── env.ts                ← Zod-validated env schema
│   │   ├── database.ts           ← Prisma client singleton
│   │   ├── redis.ts              ← Redis client singleton
│   │   └── socket.ts             ← Socket.IO setup
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.repository.ts
│   │   │   └── auth.schema.ts    ← Zod schemas
│   │   │
│   │   ├── users/
│   │   │   ├── users.routes.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.repository.ts
│   │   │   └── users.schema.ts
│   │   │
│   │   ├── friends/
│   │   │   ├── friends.routes.ts
│   │   │   ├── friends.controller.ts
│   │   │   ├── friends.service.ts
│   │   │   ├── friends.repository.ts
│   │   │   └── friends.schema.ts
│   │   │
│   │   ├── groups/
│   │   │   ├── groups.routes.ts
│   │   │   ├── groups.controller.ts
│   │   │   ├── groups.service.ts
│   │   │   ├── groups.repository.ts
│   │   │   └── groups.schema.ts
│   │   │
│   │   ├── applications/
│   │   │   ├── applications.routes.ts
│   │   │   ├── applications.controller.ts
│   │   │   ├── applications.service.ts
│   │   │   ├── applications.repository.ts
│   │   │   └── applications.schema.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.routes.ts
│   │   │   ├── notifications.controller.ts
│   │   │   ├── notifications.service.ts
│   │   │   ├── notifications.repository.ts
│   │   │   └── notifications.schema.ts
│   │   │
│   │   └── admin/
│   │       ├── admin.routes.ts
│   │       ├── admin.controller.ts
│   │       └── admin.service.ts
│   │
│   ├── middleware/
│   │   ├── authenticate.ts       ← JWT verification
│   │   ├── authorize.ts          ← Role-based access control
│   │   ├── validate.ts           ← Zod request validation
│   │   ├── rateLimiter.ts        ← Per-route rate limiting
│   │   ├── errorHandler.ts       ← Global error handler
│   │   ├── requestLogger.ts      ← Structured request logging
│   │   └── auditLogger.ts        ← Audit trail logging
│   │
│   ├── workers/
│   │   ├── notificationWorker.ts ← BullMQ: process notification jobs
│   │   ├── linkHealthWorker.ts   ← BullMQ: check job link validity
│   │   └── queues.ts             ← Queue definitions
│   │
│   ├── services/
│   │   ├── urlNormalizer.ts      ← URL normalization + hashing
│   │   ├── codeGenerator.ts      ← Friend/group code generation
│   │   ├── tokenService.ts       ← JWT + refresh token management
│   │   ├── emailService.ts       ← Email sending (transactional)
│   │   └── cacheService.ts       ← Redis cache abstraction
│   │
│   ├── lib/
│   │   ├── errors.ts             ← Custom error classes
│   │   ├── response.ts           ← Standard response builders
│   │   └── logger.ts             ← Winston logger setup
│   │
│   └── types/
│       ├── express.d.ts          ← Augment req.user type
│       └── index.ts              ← Shared type exports
│
├── prisma/
│   ├── schema.prisma             ← Database schema
│   └── migrations/               ← Migration history
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Backend Architecture Patterns

### Controller Layer

Controllers are thin. They only:
1. Call the validate middleware (already run)
2. Call the service
3. Return the response

```typescript
// applications.controller.ts
export const createApplication = async (req: Request, res: Response) => {
  const application = await applicationsService.create(req.user.id, req.body);
  return res.status(201).json(success(application));
};
```

### Service Layer

Services contain **all business logic**:
- Orchestrate repository calls
- Enforce business rules (e.g., duplicate check)
- Call other services
- Publish queue jobs

```typescript
// applications.service.ts
export const create = async (userId: string, dto: CreateApplicationDto) => {
  const canonicalUrl = urlNormalizer.normalize(dto.url);
  const canonicalHash = urlNormalizer.hash(canonicalUrl);

  const duplicate = await applicationsRepo.findByHash(userId, canonicalHash);
  if (duplicate) throw new ConflictError('DUPLICATE_APPLICATION');

  const application = await applicationsRepo.create({
    userId, canonicalUrl, canonicalHash, ...dto
  });

  await notificationQueue.add('notify-new-application', {
    applicationId: application.id,
    userId,
  });

  return application;
};
```

### Repository Layer

Repositories are the only layer that touches the database. Pure data access — no business logic.

```typescript
// applications.repository.ts
export const findByHash = (userId: string, hash: string) =>
  prisma.application.findUnique({
    where: { userId_canonicalHash: { userId, canonicalHash: hash } }
  });

export const create = (data: CreateApplicationData) =>
  prisma.application.create({ data });
```

### Middleware Structure

Middleware is stacked in this order for every protected route:

```
Request
  → rateLimiter        (per-route limits, Redis-backed)
  → authenticate       (verify JWT, attach req.user)
  → validate(schema)   (Zod validation, 400 on failure)
  → authorize(role?)   (optional role check)
  → requestLogger      (log incoming request)
  → [route handler]
  → auditLogger        (async, log action to audit_logs)
  → errorHandler       (catch-all, format error response)
```

### Validation Structure

All incoming data is validated with Zod before reaching the controller.

```typescript
// applications.schema.ts
export const createApplicationSchema = z.object({
  body: z.object({
    url: z.string().url(),
    companyName: z.string().max(255).optional(),
    role: z.string().max(255).optional(),
    appliedAt: z.string().date().optional(),
    status: applicationStatusEnum.optional(),
    notes: z.string().max(2000).optional(),
    visibility: visibilityEnum.optional(),
  })
});
```

```typescript
// validate.ts middleware
export const validate = (schema: AnyZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await schema.safeParseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (!result.success) {
      return res.status(400).json(error('VALIDATION_ERROR', result.error.flatten()));
    }
    req.validated = result.data;
    next();
  };
```

### Error Handling Strategy

Custom error classes inherit from a base `AppError`:

```typescript
// errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) { super(message); }
}

export class ConflictError extends AppError {
  constructor(code: string, msg = 'Conflict') {
    super(409, code, msg);
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = 'Forbidden') { super(403, 'FORBIDDEN', msg); }
}
```

Global error handler converts any thrown error to a standard response:

```typescript
// errorHandler.ts
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message }
    });
  }
  // Unhandled errors
  logger.error('Unhandled error', { err, path: req.path });
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' }
  });
};
```

---

## Frontend Project Structure (`apps/web/`)

```
apps/web/
├── src/
│   ├── app/                      ← Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx        ← Authenticated layout (nav, sidebar)
│   │   │   ├── page.tsx          ← Dashboard home
│   │   │   ├── friends/
│   │   │   │   ├── page.tsx      ← Friend list
│   │   │   │   └── [id]/page.tsx ← Friend feed
│   │   │   ├── groups/
│   │   │   │   ├── page.tsx      ← Group list
│   │   │   │   └── [id]/page.tsx ← Group feed
│   │   │   └── profile/page.tsx  ← Profile (codes, applications)
│   │   ├── layout.tsx            ← Root layout
│   │   └── not-found.tsx
│   │
│   ├── components/
│   │   ├── ui/                   ← Primitives (Button, Input, Modal)
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── RegisterForm.tsx
│   │   ├── dashboard/
│   │   │   ├── JobInput.tsx      ← URL paste + submit
│   │   │   ├── FeedCard.tsx      ← Job card in feed
│   │   │   └── ApplicationCard.tsx
│   │   ├── friends/
│   │   │   ├── AddFriendModal.tsx
│   │   │   ├── FriendCard.tsx
│   │   │   └── FriendRequestBadge.tsx
│   │   ├── groups/
│   │   │   ├── CreateGroupModal.tsx
│   │   │   ├── JoinGroupModal.tsx
│   │   │   └── GroupCard.tsx
│   │   ├── notifications/
│   │   │   └── NotificationBell.tsx
│   │   └── layout/
│   │       ├── Navbar.tsx
│   │       └── Sidebar.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts            ← Auth state + actions
│   │   ├── useFriendFeed.ts      ← Friend feed with React Query
│   │   ├── useGroupFeed.ts       ← Group feed
│   │   ├── useNotifications.ts   ← Real-time notifications
│   │   └── useSocket.ts          ← Socket.IO connection
│   │
│   ├── lib/
│   │   ├── api.ts                ← Axios instance with interceptors
│   │   ├── queryClient.ts        ← TanStack Query setup
│   │   └── socket.ts             ← Socket.IO client
│   │
│   ├── store/
│   │   ├── authStore.ts          ← Zustand: user + token
│   │   └── notificationStore.ts  ← Zustand: unread count
│   │
│   └── types/
│       └── index.ts              ← Shared TypeScript types
│
├── public/
├── next.config.ts
└── tailwind.config.ts
```

---

## Service Layer Design (Shared Services)

### urlNormalizer.ts

```typescript
// Fully deterministic URL normalization
normalize(rawUrl: string): string
hash(canonicalUrl: string): string  // SHA-256 hex
```

### codeGenerator.ts

```typescript
// Friend codes: ABX9-KLQ7-8P21
// Group codes: GROUP-X92KLQ
generateFriendCode(): string   // nanoid + format + collision check
generateGroupCode(): string    // "GROUP-" + nanoid(6)
```

### tokenService.ts

```typescript
signAccessToken(userId: string, role: string): string    // 15min JWT
signRefreshToken(): string                               // 64-byte random hex
hashToken(token: string): string                         // SHA-256 for DB storage
verifyAccessToken(token: string): JwtPayload
```

### cacheService.ts

```typescript
// Abstraction over Redis to allow testing with in-memory store
get(key: string): Promise<string | null>
set(key: string, value: string, ttlSeconds: number): Promise<void>
del(key: string): Promise<void>
sadd(key: string, ...members: string[]): Promise<void>
smembers(key: string): Promise<string[]>
```
