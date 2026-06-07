# JobSync — API Documentation

---

## Conventions

- **Base URL**: `https://api.jobsync.app/v1`
- **Auth Header**: `Authorization: Bearer <access_token>`
- **Refresh Token**: Delivered via `httpOnly` cookie (`jobsync_refresh`)
- **Content-Type**: `application/json`
- **Pagination**: `?page=1&limit=20` (default limit: 20, max: 100)
- **Error Format**:

```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_APPLICATION",
    "message": "You have already applied to this job.",
    "details": {}
  }
}
```

- **Success Format**:

```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 42 }
}
```

---

## Authentication APIs

### POST /auth/register

Register a new user.

**Auth Required**: No

**Request Body**:
```json
{
  "username": "kirankumar",
  "email": "user@example.com",
  "password": "SuperSecret123!"
}
```

**Validation**:
- `username`: 3–50 chars, alphanumeric + underscore, no spaces
- `password`: Min 8 chars, 1 uppercase, 1 number, 1 special char
- `email`: Valid email format (optional at MVP)

**Response 201**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "kirankumar",
      "friendCode": "ABX9-KLQ7-8P21",
      "emailVerified": false,
      "createdAt": "2025-01-01T00:00:00Z"
    },
    "accessToken": "eyJ..."
  }
}
```
*Refresh token set as httpOnly cookie.*

**Errors**:
- `400 USERNAME_TAKEN` — Username already exists
- `400 EMAIL_TAKEN` — Email already registered
- `400 VALIDATION_ERROR` — Invalid input format

---

### POST /auth/login

Authenticate an existing user.

**Auth Required**: No

**Request Body**:
```json
{
  "username": "kirankumar",
  "password": "SuperSecret123!"
}
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "kirankumar",
      "friendCode": "ABX9-KLQ7-8P21"
    },
    "accessToken": "eyJ..."
  }
}
```

**Errors**:
- `401 INVALID_CREDENTIALS` — Wrong username or password
- `403 ACCOUNT_BANNED` — Account has been suspended
- `429 RATE_LIMITED` — Too many login attempts

---

### POST /auth/refresh

Issue new access token using refresh token cookie.

**Auth Required**: No (uses httpOnly cookie)

**Request Body**: *(empty)*

**Response 200**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ..."
  }
}
```

**Errors**:
- `401 REFRESH_TOKEN_INVALID` — Token not found or revoked
- `401 REFRESH_TOKEN_EXPIRED` — Token expired

---

### POST /auth/logout

Invalidate session.

**Auth Required**: Yes

**Request Body**: *(empty)*

**Response 200**:
```json
{ "success": true, "data": { "message": "Logged out successfully." } }
```

---

### POST /auth/forgot-password

Send password reset email.

**Auth Required**: No

**Request Body**:
```json
{ "email": "user@example.com" }
```

**Response 200** (always, to prevent email enumeration):
```json
{ "success": true, "data": { "message": "If that email exists, a reset link has been sent." } }
```

---

### POST /auth/reset-password

Reset password with token from email.

**Auth Required**: No

**Request Body**:
```json
{
  "token": "abc123...",
  "newPassword": "NewPassword456!"
}
```

**Response 200**:
```json
{ "success": true, "data": { "message": "Password updated successfully." } }
```

**Errors**:
- `400 TOKEN_INVALID` — Token not found
- `400 TOKEN_EXPIRED` — Token expired
- `400 VALIDATION_ERROR` — Weak password

---

### POST /auth/verify-email

Verify email with token from verification email.

**Auth Required**: No

**Request Body**:
```json
{ "token": "abc123..." }
```

**Response 200**:
```json
{ "success": true, "data": { "message": "Email verified." } }
```

---

## User APIs

### GET /users/me

Get current user's full profile.

**Auth Required**: Yes

**Response 200**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "kirankumar",
    "email": "user@example.com",
    "friendCode": "ABX9-KLQ7-8P21",
    "emailVerified": true,
    "avatarUrl": null,
    "bio": "Looking for SWE roles",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

---

### PATCH /users/me

Update own profile.

**Auth Required**: Yes

**Request Body** (all optional):
```json
{
  "bio": "SWE @ Seeking opportunities",
  "avatarUrl": "https://..."
}
```

**Response 200**: Updated user object.

**Errors**:
- `400 VALIDATION_ERROR`

---

### GET /users/:username

Get public profile of another user.

**Auth Required**: Yes

**Response 200**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "friendCode": "XXXX-XXXX-XXXX",
    "bio": "...",
    "isFriend": true,
    "applicationCount": 12
  }
}
```

**Errors**:
- `404 USER_NOT_FOUND`

---

## Friend APIs

### GET /friends

List current user's friends.

**Auth Required**: Yes

**Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "johndoe",
      "friendCode": "ABCD-EFGH-1234",
      "bio": "...",
      "connectedAt": "2025-01-15T00:00:00Z"
    }
  ]
}
```

---

### POST /friends/request

Send a friend request by friend code.

**Auth Required**: Yes

**Request Body**:
```json
{ "friendCode": "ABX9-KLQ7-8P21" }
```

**Response 201**:
```json
{
  "success": true,
  "data": {
    "requestId": "uuid",
    "to": { "username": "johndoe" },
    "status": "pending"
  }
}
```

**Errors**:
- `400 INVALID_FRIEND_CODE` — Code not found
- `400 ALREADY_FRIENDS` — Already connected
- `400 REQUEST_PENDING` — Request already sent
- `400 SELF_REQUEST` — Cannot add yourself

---

### GET /friends/requests

List incoming friend requests.

**Auth Required**: Yes

**Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "requestId": "uuid",
      "from": { "username": "alice", "friendCode": "..." },
      "sentAt": "2025-01-10T00:00:00Z"
    }
  ]
}
```

---

### PUT /friends/requests/:requestId/accept

Accept a friend request.

**Auth Required**: Yes

**Response 200**:
```json
{ "success": true, "data": { "message": "Friend added." } }
```

**Errors**:
- `404 REQUEST_NOT_FOUND`
- `403 NOT_RECIPIENT` — You are not the receiver

---

### PUT /friends/requests/:requestId/reject

Reject a friend request.

**Auth Required**: Yes

**Response 200**:
```json
{ "success": true, "data": { "message": "Request rejected." } }
```

---

### DELETE /friends/:friendId

Remove a friend.

**Auth Required**: Yes

**Response 200**:
```json
{ "success": true, "data": { "message": "Friend removed." } }
```

**Errors**:
- `404 NOT_FRIENDS`

---

### GET /friends/:friendId/feed

Get jobs this friend applied to that the current user hasn't.

**Auth Required**: Yes (must be friends)

**Query Params**: `?page=1&limit=20`

**Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "canonicalUrl": "https://company.com/job/123",
      "companyName": "Acme Corp",
      "role": "Backend Engineer",
      "status": "interview",
      "appliedAt": "2025-01-20",
      "appliedBy": { "username": "johndoe" }
    }
  ],
  "meta": { "page": 1, "total": 7 }
}
```

**Errors**:
- `403 NOT_FRIENDS` — Must be friends to view feed
- `404 USER_NOT_FOUND`

---

## Group APIs

### POST /groups

Create a new group.

**Auth Required**: Yes

**Request Body**:
```json
{
  "name": "CUSAT Placement 2025",
  "description": "Group for CUSAT CS batch"
}
```

**Response 201**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "CUSAT Placement 2025",
    "groupCode": "GROUP-X92KLQ",
    "ownerUsername": "kirankumar",
    "memberCount": 1,
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

---

### GET /groups

List groups the current user is in (created + joined).

**Auth Required**: Yes

**Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "CUSAT Placement 2025",
      "groupCode": "GROUP-X92KLQ",
      "memberCount": 42,
      "role": "owner",
      "joinedAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /groups/join

Join an existing group using group code.

**Auth Required**: Yes

**Request Body**:
```json
{ "groupCode": "GROUP-X92KLQ" }
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "group": { "id": "uuid", "name": "CUSAT Placement 2025" },
    "message": "Joined group successfully."
  }
}
```

**Errors**:
- `404 GROUP_NOT_FOUND` — Invalid code
- `400 ALREADY_MEMBER`
- `400 GROUP_FULL`

---

### GET /groups/:groupId

Get group details and members.

**Auth Required**: Yes (must be member)

**Response 200**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "CUSAT Placement 2025",
    "groupCode": "GROUP-X92KLQ",
    "description": "...",
    "ownerUsername": "kirankumar",
    "memberCount": 42,
    "members": [
      { "username": "alice", "role": "member", "joinedAt": "..." }
    ]
  }
}
```

---

### GET /groups/:groupId/feed

Get jobs group members applied to that the current user hasn't.

**Auth Required**: Yes (must be member)

**Query Params**: `?page=1&limit=20`

**Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "canonicalUrl": "https://company.com/job/456",
      "companyName": "TechCorp",
      "role": "Frontend Engineer",
      "appliedBy": { "username": "alice" },
      "appliedAt": "2025-01-25"
    }
  ],
  "meta": { "page": 1, "total": 23 }
}
```

---

### DELETE /groups/:groupId/members/:userId

Remove a member (owner only).

**Auth Required**: Yes (owner only)

**Response 200**:
```json
{ "success": true, "data": { "message": "Member removed." } }
```

**Errors**:
- `403 NOT_OWNER`
- `404 MEMBER_NOT_FOUND`

---

### DELETE /groups/:groupId/leave

Leave a group.

**Auth Required**: Yes (must be member, not owner)

**Response 200**:
```json
{ "success": true, "data": { "message": "Left group." } }
```

**Errors**:
- `400 OWNER_CANNOT_LEAVE` — Owner must transfer ownership or delete group

---

### DELETE /groups/:groupId

Delete a group (owner only).

**Auth Required**: Yes (owner only)

**Response 200**:
```json
{ "success": true, "data": { "message": "Group deleted." } }
```

---

## Application APIs

### POST /applications

Save a job application.

**Auth Required**: Yes

**Request Body**:
```json
{
  "url": "https://company.com/job/123?utm_source=linkedin",
  "companyName": "Acme Corp",
  "role": "Backend Engineer",
  "appliedAt": "2025-01-20",
  "status": "applied",
  "notes": "Applied via LinkedIn Easy Apply",
  "visibility": "friends"
}
```

**Processing**:
1. Normalize URL → strip tracking params
2. Generate canonical hash
3. Check for duplicate
4. Save if unique

**Response 201**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "rawUrl": "https://company.com/job/123?utm_source=linkedin",
    "canonicalUrl": "https://company.com/job/123",
    "companyName": "Acme Corp",
    "role": "Backend Engineer",
    "appliedAt": "2025-01-20",
    "status": "applied",
    "visibility": "friends",
    "createdAt": "2025-01-20T10:00:00Z"
  }
}
```

**Errors**:
- `409 DUPLICATE_APPLICATION` — Already applied to this job
- `400 INVALID_URL` — URL could not be parsed

---

### GET /applications

Get all applications for the current user.

**Auth Required**: Yes

**Query Params**: `?page=1&limit=20&status=applied&sort=date_desc`

**Response 200**:
```json
{
  "success": true,
  "data": [ { ...application } ],
  "meta": { "page": 1, "total": 34 }
}
```

---

### GET /applications/:id

Get a single application.

**Auth Required**: Yes (own application only)

**Response 200**: Single application object.

**Errors**:
- `403 FORBIDDEN`
- `404 NOT_FOUND`

---

### PATCH /applications/:id

Update an application's status, notes, or visibility.

**Auth Required**: Yes

**Request Body** (all optional):
```json
{
  "status": "interview",
  "notes": "Got interview scheduled for Feb 1",
  "visibility": "private"
}
```

**Response 200**: Updated application object.

---

### DELETE /applications/:id

Delete an application.

**Auth Required**: Yes

**Response 200**:
```json
{ "success": true, "data": { "message": "Application removed." } }
```

---

## Notification APIs

### GET /notifications

Get notifications for the current user.

**Auth Required**: Yes

**Query Params**: `?page=1&limit=20&unread_only=true`

**Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "new_job_from_friend",
      "message": "johndoe applied to a new job at Acme Corp",
      "entityType": "application",
      "entityId": "uuid",
      "isRead": false,
      "createdAt": "2025-01-25T08:00:00Z"
    }
  ],
  "meta": { "unreadCount": 3 }
}
```

---

### PUT /notifications/:id/read

Mark a notification as read.

**Auth Required**: Yes

**Response 200**:
```json
{ "success": true, "data": { "message": "Marked as read." } }
```

---

### PUT /notifications/read-all

Mark all notifications as read.

**Auth Required**: Yes

**Response 200**:
```json
{ "success": true, "data": { "message": "All marked as read." } }
```

---

## Admin APIs

> All admin routes require `role: 'admin'` claim in JWT.

### GET /admin/users

List all users with search/filter.

**Query Params**: `?q=username&status=active&page=1`

**Response 200**: Paginated user list with full details.

---

### PATCH /admin/users/:id/ban

Ban a user account.

**Request Body**:
```json
{ "reason": "Spam abuse", "durationDays": 30 }
```

**Response 200**: Updated user object.

---

### GET /admin/audit-logs

View audit log entries.

**Query Params**: `?action=LOGIN&userId=...&from=2025-01-01&to=2025-01-31`

**Response 200**: Paginated audit log entries.

---

### GET /admin/stats

Platform statistics.

**Response 200**:
```json
{
  "success": true,
  "data": {
    "totalUsers": 1042,
    "activeUsersLast7Days": 342,
    "totalApplications": 12450,
    "totalGroups": 87,
    "duplicatesBlockedTotal": 890
  }
}
```

---

## WebSocket Events (Socket.IO)

### Connection

```javascript
// Client connects with JWT
const socket = io('wss://api.jobsync.app', {
  auth: { token: accessToken }
});
```

### Events (Server → Client)

| Event | Payload | Trigger |
|---|---|---|
| `notification:new` | `{ notification }` | Friend/group member saved a new job you haven't applied to |
| `friend:request` | `{ from: username }` | New friend request received |
| `friend:accepted` | `{ by: username }` | Your friend request was accepted |
| `feed:update` | `{ friendId or groupId }` | New job added in watched feed |

### Events (Client → Server)

| Event | Payload | Purpose |
|---|---|---|
| `notification:read` | `{ notificationId }` | Mark notification read in real time |
| `feed:subscribe` | `{ type: 'friend' or 'group', id }` | Subscribe to feed updates |
