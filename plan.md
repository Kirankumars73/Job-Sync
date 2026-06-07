# JobSync — Product Plan

---

## Product Overview

JobSync is a collaborative job-tracking platform that solves a real problem in modern job hunting: **information asymmetry among friends**. When a group of peers is job hunting simultaneously, they often apply to the same positions without knowing it — or worse, miss great opportunities that their friends have already discovered.

JobSync creates a private, trusted network where job seekers can:
- Track their own applications
- See what their friends have applied for
- Filter out jobs they've already applied to
- Collaborate within groups (cohorts, bootcamps, university batches, referral circles)

The core value proposition is **zero noise**. When you open a friend's feed or a group feed, you only see jobs you haven't touched yet.

---

## Business Objective

| Objective | Metric |
|---|---|
| Help users discover 3× more relevant job opportunities | Avg new jobs discovered per session |
| Reduce duplicate applications within friend groups | Duplicate detection rate |
| Build a retention loop through social accountability | DAU / MAU ratio |
| Achieve 100,000 active users within 12 months | Registered + active users |
| Become the default job coordination tool for university placement cells and bootcamps | B2B group adoption |

---

## User Stories

### Authentication

- As a new user, I want to register with a username and password so that I can access the platform.
- As a registered user, I want to log in securely so that my job data is protected.
- As a user, I want to verify my email so that my account is recoverable.
- As a user, I want to reset my password if I forget it.
- As a user, I want my session to expire after inactivity so that my account stays secure.

### Friend Code & Friend System

- As a user, I want to receive a unique friend code upon registration so I can share it with people I trust.
- As a user, I want to add a friend by entering their friend code so I can connect without sharing personal info.
- As a user, I want to accept or reject incoming friend requests so I control who sees my applications.
- As a user, I want to remove a friend so I can revoke their access to my applications.
- As a user, I want to view my friends' profiles and shared applications on a dashboard.

### Groups

- As a user, I want to create a group so I can coordinate with a specific circle.
- As a user, I want to join a group using a group code so I can collaborate with my cohort.
- As a user, I want to see all groups I own and have joined in my profile.
- As a group owner, I want to remove members and control membership so I can maintain trust.
- As a user, I want each group to have a unique share code so others can join.

### Job Tracking

- As a user, I want to paste a job URL and have it saved to my application list.
- As a user, I want to add company name, role, and date applied to each entry.
- As a user, I want to update the status of my application (Applied, OA, Interview, Rejected, Offer).
- As a user, I want to add notes to a job application.
- As a user, I want the system to prevent me from adding duplicate jobs even if the URL has tracking params.
- As a user, I want to set visibility on each job (Private, Friends Only, Group, Public).

### Friend Feed & Group Feed

- As a user, I want to open a friend's profile and see only jobs they applied for that I haven't.
- As a user, I want to open a group feed and see only jobs group members applied for that I haven't.
- As a user, I want the feeds to update in real time when friends add new jobs.

### Notifications

- As a user, I want to be notified when a friend adds a new job I haven't applied to.
- As a user, I want to be notified when a group member adds a new job I haven't applied to.
- As a user, I want to see a notification center with all unseen opportunities.

### Profile

- As a user, I want to view my username and friend code in my profile.
- As a user, I want to see all groups I've created and joined along with their codes.
- As a user, I want to view a full list of every job I've personally applied for.

---

## Functional Requirements

### FR-01 Authentication
- Registration with username + password
- bcrypt / Argon2 password hashing
- JWT + Refresh Token authentication
- Email verification (optional at MVP, required post-MVP)
- Forgot password / reset flow
- Secure logout (token invalidation)

### FR-02 Unique Friend Code
- Generate a unique, unguessable alphanumeric code per user (e.g. `ABX9-KLQ7-8P21`)
- Codes must not expose sequential IDs
- Codes are permanent and cannot be changed

### FR-03 Friend System
- Add friend via code
- Friend request flow (send → accept/reject)
- Remove friend
- Friend list view in dashboard

### FR-04 Group System
- Create group (user becomes owner)
- Auto-generate unique group code (e.g. `GROUP-X92KLQ`)
- Join group via code
- Group owner can remove members
- View group member list
- Leave group

### FR-05 Job Tracking
- Save job: URL, company, role, date applied
- Optional: status, notes, visibility
- URL normalization (strip tracking params)
- Canonical fingerprint hashing to prevent duplicates
- CRUD operations on personal applications

### FR-06 Duplicate Detection
- On save: normalize URL → generate canonical hash
- Check hash against user's existing applications
- Block duplicate save; return informative error

### FR-07 Friend Feed
- Query: Friend's applications WHERE NOT IN (current user's applications)
- Respect visibility settings of each job
- Sorted by date (newest first)

### FR-08 Group Feed
- Query: Group members' applications WHERE NOT IN (current user's applications)
- Aggregated across all members in the group
- Respect visibility settings
- Sorted by date (newest first)

### FR-09 Notifications
- Event-driven: new job added by friend or group member
- Only notify if the job is not already in current user's applications
- Notification center with read/unread states

### FR-10 Admin
- User management (ban, suspend, view)
- Abuse reporting review
- Audit log viewer
- System health dashboard

---

## Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | API response < 200ms (p95) under normal load |
| **Scalability** | Support 100,000+ concurrent users |
| **Availability** | 99.9% uptime SLA |
| **Security** | OWASP Top 10 compliance, no plaintext passwords |
| **Data Integrity** | No duplicate applications per user |
| **Maintainability** | Modular codebase, documented APIs |
| **Mobile-readiness** | Responsive web; REST API ready for native apps |
| **Observability** | Structured logs, metrics, alerting |
| **Privacy** | User-controlled visibility per application |
| **Compliance** | GDPR-ready architecture |

---

## Feature Prioritization (MoSCoW)

### Must Have (MVP)
- User registration and login
- Unique friend code generation
- Add/accept/remove friends
- Create/join groups via code
- Save job application (URL + basic metadata)
- URL normalization and duplicate detection
- Friend feed (filtered)
- Group feed (filtered)
- Profile view (code, groups, applications)

### Should Have (v1.1)
- Email verification
- Password reset flow
- Application status tracking (Applied → Offer)
- Visibility controls per job
- Notification system (in-app)
- Real-time feed updates (WebSocket)
- Application notes

### Could Have (v1.2+)
- Job expiry detection (link validity check)
- Recommendation engine ("15 jobs your friends applied to")
- Invite links (onboarding improvement)
- Push notifications
- Mobile app (React Native)
- Export applications to CSV

### Won't Have (MVP)
- AI-based job matching
- Resume upload
- Direct messaging
- Payment / premium tiers

---

## MVP Roadmap

### Week 1–2: Foundation
- Project scaffolding (monorepo)
- Database schema design and migrations
- Auth system (register, login, JWT)
- Friend code generation logic
- Basic user profile API

### Week 3–4: Core Social
- Friend request system (send, accept, reject, remove)
- Group CRUD (create, join, leave, owner controls)
- Group code generation

### Week 5–6: Job Tracking
- Job application CRUD API
- URL normalization engine
- Canonical fingerprint generation
- Duplicate detection middleware

### Week 7–8: Feeds
- Friend feed query (filtered)
- Group feed query (filtered, aggregated)
- Feed caching (Redis)

### Week 9–10: Frontend
- Auth pages (login, register)
- Dashboard (friend list, group list, job input)
- Profile view
- Friend feed UI
- Group feed UI

### Week 11–12: Polish & Launch
- Error handling, loading states
- Basic notification system
- Security hardening
- Deployment (Docker + Railway / Render)
- Beta testing with 50 users

---

## Future Roadmap

| Phase | Features |
|---|---|
| **v1.1** | Email verification, password reset, application status, visibility controls |
| **v1.2** | Real-time updates (Socket.IO), notification center, invite links |
| **v1.3** | Job expiry detection, recommendation engine |
| **v2.0** | Mobile app (React Native), push notifications |
| **v2.1** | Admin dashboard, abuse monitoring |
| **v3.0** | API for university placement cells (B2B), premium tiers |

---

## Development Milestones

| Milestone | Target | Success Criteria |
|---|---|---|
| M1: Auth + Profile | Week 2 | User can register, login, view profile with friend code |
| M2: Social Graph | Week 4 | Users can add friends and create/join groups |
| M3: Job Tracking | Week 6 | Users can save jobs; duplicates are blocked |
| M4: Feeds | Week 8 | Friend and group feeds work with correct filtering |
| M5: Frontend MVP | Week 10 | Full UI functional end-to-end |
| M6: Beta Launch | Week 12 | 50 beta users, <5 critical bugs |
| M7: Public Launch | Month 4 | 1,000 registered users |
| M8: Scale | Month 6 | 10,000 users, Redis caching live |
