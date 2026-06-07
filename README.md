<div align="center">

<img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white" />
<img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
<img src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
<img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />

# 🎯 JobSync

### *Collaborate on your job hunt with friends*

**JobSync** is a private, real-time job application tracker that lets you and your friends share progress, stay motivated, and never accidentally apply to the same company twice.

[🚀 Getting Started](#getting-started) · [✨ Features](#features) · [🏗️ How It's Made](#how-its-made) · [📸 Screenshots](#screenshots)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔗 **Paste & Track** | Drop any job posting URL — JobSync auto-extracts the company name and stores it |
| 👥 **Friend System** | Add friends by unique friend codes and see each other's applications in real time |
| 🏢 **Groups** | Create or join cohort/batch groups to coordinate with your full crew |
| 📊 **Live Dashboard** | Real-time stats — applied, OA, interviews, offers — all at a glance |
| 🌙 **Dark / Light Mode** | Beautiful sky-themed toggle with smooth transitions |
| 🔒 **Private by Default** | Your data is only visible to you and friends you explicitly connect with |
| ⚡ **Real-time Feed** | See friend activity as it happens, powered by Supabase Realtime |
| 🎨 **Glassmorphic UI** | Premium frosted-glass design with micro-animations throughout |

---

## 📸 Screenshots

> Login · Dashboard · Friends · Groups · Profile

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **npm** or **yarn**
- A free [Supabase](https://supabase.com) account

---

### 1. Clone the repository

```bash
git clone https://github.com/Kirankumars73/Job-Sync.git
cd Job-Sync/web
npm install
```

---

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Name it `jobsync`, pick a region, create it
3. Go to **Settings → API Keys → Legacy anon, service_role API keys**
4. Copy the **Project URL** and **anon** key

---

### 3. Configure environment variables

Create a file called `.env.local` inside the `web/` folder:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> ⚠️ The URL must end with `.supabase.co` — do NOT append `/rest/v1/` or any path

---

### 4. Run the database schema

1. In Supabase → **SQL Editor → New query**
2. Copy the full contents of [`web/lib/supabase/schema.sql`](./web/lib/supabase/schema.sql)
3. Paste and click **Run**
4. Go to **Authentication → Providers → Email** → turn off **"Confirm email"**

---

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 📖 How to Use

### Registering
- Choose a unique **username** (letters, numbers, underscores)
- Optionally add your email for password recovery
- You'll get a unique **Friend Code** auto-generated (e.g. `ABCD-EFGH-1234`)

### Tracking Applications
- On the **Dashboard**, paste any job posting URL into the input box
- JobSync auto-extracts the company name
- Your application is saved with status `Applied`
- Update status anytime: Applied → OA → Interview → Offer / Rejected

### Adding Friends
1. Go to **Friends** page
2. Share your Friend Code with your buddies
3. They paste your code → you both become connected
4. You'll see each other's job applications in the live feed

### Creating / Joining Groups
- Go to **Groups** → **Create** to start a group (you get a group code to share)
- Or click **Join** and paste someone's group code
- Groups are great for batch-mates, bootcamp cohorts, referral circles

### Profile Page
- See all your applications in one place
- Filter by status
- View your status breakdown chart
- Copy your Friend Code to share

---

## 🏗️ How It's Made

### Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 (CSS-first config) |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL + Row Level Security) |
| **Real-time** | Supabase Realtime (postgres_changes) |
| **3D Animation** | Three.js (login page shader) |
| **UI Components** | Custom glassmorphic components (no component library) |
| **Fonts** | Inter (Google Fonts) |
| **Animations** | CSS transitions + styled-components (sky toggle) |

---

### Architecture

```
Job-Sync/
└── web/
    ├── app/
    │   ├── actions/          # Server actions (auth, applications, friends, groups)
    │   ├── dashboard/        # Protected dashboard pages
    │   │   ├── page.tsx      # Home — live feed + stats
    │   │   ├── friends/      # Friend management
    │   │   ├── groups/       # Group management
    │   │   └── profile/      # Profile + all applications
    │   ├── login/            # Auth pages
    │   └── register/
    ├── components/
    │   ├── layout/           # Navbar + Sidebar
    │   └── ui/               # Reusable UI (toggle, buttons, animations)
    ├── lib/
    │   ├── context/          # UserContext (global auth state)
    │   ├── supabase/         # Supabase client + schema
    │   └── types/            # TypeScript interfaces
    └── proxy.ts              # Auth middleware (Next.js 16)
```

### Database Design

```
auth.users (Supabase built-in)
    │
    ├── profiles          — username, friend_code, avatar
    ├── friend_requests   — sender → receiver, status
    ├── friendships       — bidirectional pairs
    ├── groups            — name, group_code, owner
    ├── group_members     — user ↔ group with role
    ├── applications      — job URL, company, status, visibility
    └── notifications     — friend/group activity events
```

### Key Design Decisions

- **Username-only auth** — Supabase requires emails internally, so we map `username → username@jobsync.internal` behind the scenes. Users never see this.
- **Friend codes** — Random 12-character codes (`XXXX-XXXX-XXXX`) generated in PostgreSQL, collision-safe
- **Row Level Security** — All data access is enforced at the database level, not just the API
- **Glassmorphic design** — CSS `backdrop-filter: blur()` + semi-transparent backgrounds for the premium glass look
- **Real-time feed** — Supabase `postgres_changes` subscription updates the dashboard live without polling

---

## 🔐 Privacy & Security

- All tables have **Row Level Security (RLS)** enabled
- Your applications are only visible to you, and optionally to friends or group members (you control visibility per-app)
- Passwords are hashed by Supabase Auth (bcrypt)
- `.env.local` is gitignored — your keys are never committed

---

## 📄 License

MIT — free to use, fork, and build on.

---

<div align="center">
Made with ❤️ for job hunters who hunt together
</div>
