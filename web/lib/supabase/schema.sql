-- ============================================================
-- JobSync — Supabase SQL Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Helper: generate random friend code ─────────────────────
CREATE OR REPLACE FUNCTION generate_friend_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..4 LOOP code := code || substr(chars, floor(random()*length(chars)+1)::int, 1); END LOOP;
  code := code || '-';
  FOR i IN 1..4 LOOP code := code || substr(chars, floor(random()*length(chars)+1)::int, 1); END LOOP;
  code := code || '-';
  FOR i IN 1..4 LOOP code := code || substr(chars, floor(random()*length(chars)+1)::int, 1); END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ── Helper: generate unique friend code with collision check ─
CREATE OR REPLACE FUNCTION unique_friend_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
BEGIN
  LOOP
    code := generate_friend_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE friend_code = code);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ── Helper: generate unique group code ───────────────────────
CREATE OR REPLACE FUNCTION unique_group_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  i INT;
BEGIN
  LOOP
    code := 'GROUP-';
    FOR i IN 1..6 LOOP code := code || substr(chars, floor(random()*length(chars)+1)::int, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM groups WHERE group_code = code);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ── Profiles (extends auth.users) ────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT          NOT NULL UNIQUE,
  friend_code   TEXT          NOT NULL UNIQUE DEFAULT unique_friend_code(),
  avatar_url    TEXT,
  bio           TEXT,
  is_active     BOOLEAN       DEFAULT TRUE,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username    ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_friend_code ON profiles(friend_code);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Friend Requests ──────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE friend_request_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS friend_requests (
  id            UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     UUID                  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id   UUID                  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        friend_request_status DEFAULT 'pending',
  created_at    TIMESTAMPTZ           DEFAULT NOW(),
  updated_at    TIMESTAMPTZ           DEFAULT NOW(),
  CONSTRAINT chk_no_self_request CHECK (sender_id <> receiver_id),
  CONSTRAINT uq_friend_request    UNIQUE (sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender   ON friend_requests(sender_id,   status);

-- ── Friendships (bidirectional) ──────────────────────────────
CREATE TABLE IF NOT EXISTS friendships (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_no_self_friendship CHECK (user_id <> friend_id),
  CONSTRAINT uq_friendship           UNIQUE (user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user   ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);

-- ── Groups ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  description   TEXT,
  group_code    TEXT        NOT NULL UNIQUE DEFAULT unique_group_code(),
  owner_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  is_active     BOOLEAN     DEFAULT TRUE,
  max_members   INT         DEFAULT 200,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_groups_code  ON groups(group_code);

DROP TRIGGER IF EXISTS trg_groups_updated_at ON groups;
CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Group Members ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE group_member_role AS ENUM ('owner', 'moderator', 'member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS group_members (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID              NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID              NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        group_member_role DEFAULT 'member',
  joined_at   TIMESTAMPTZ       DEFAULT NOW(),
  CONSTRAINT uq_group_member UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user  ON group_members(user_id);

-- ── Applications ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE application_status AS ENUM ('applied', 'oa_received', 'interview', 'offer', 'rejected', 'withdrawn', 'no_response');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE visibility_level AS ENUM ('private', 'friends', 'groups', 'public');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS applications (
  id              UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID               NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  raw_url         TEXT               NOT NULL,
  canonical_url   TEXT               NOT NULL,
  canonical_hash  TEXT               NOT NULL,
  company_name    TEXT,
  role            TEXT,
  job_location    TEXT,
  applied_at      DATE               DEFAULT CURRENT_DATE,
  status          application_status DEFAULT 'applied',
  notes           TEXT,
  visibility      visibility_level   DEFAULT 'friends',
  link_active     BOOLEAN            DEFAULT TRUE,
  created_at      TIMESTAMPTZ        DEFAULT NOW(),
  updated_at      TIMESTAMPTZ        DEFAULT NOW(),
  CONSTRAINT uq_user_job UNIQUE (user_id, canonical_hash)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_user_hash    ON applications(user_id, canonical_hash);
CREATE INDEX IF NOT EXISTS        idx_applications_user_created ON applications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS        idx_applications_visibility   ON applications(user_id, visibility, created_at DESC);

DROP TRIGGER IF EXISTS trg_applications_updated_at ON applications;
CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Notifications ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'friend_request_received',
    'friend_request_accepted',
    'new_job_from_friend',
    'new_job_in_group',
    'group_invite',
    'group_member_joined',
    'system_announcement'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID              NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id     UUID              REFERENCES profiles(id) ON DELETE SET NULL,
  type          notification_type NOT NULL,
  entity_type   TEXT,
  entity_id     UUID,
  message       TEXT,
  is_read       BOOLEAN           DEFAULT FALSE,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ       DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON notifications(recipient_id, created_at DESC) WHERE is_read = FALSE;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships     ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;

-- profiles: anyone can read (needed for friend code lookup), only owner can update
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"  ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"  ON profiles FOR UPDATE USING (auth.uid() = id);

-- friend_requests: sender or receiver can see
DROP POLICY IF EXISTS "freq_select" ON friend_requests;
CREATE POLICY "freq_select" ON friend_requests FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
DROP POLICY IF EXISTS "freq_insert" ON friend_requests;
CREATE POLICY "freq_insert" ON friend_requests FOR INSERT WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "freq_update" ON friend_requests;
CREATE POLICY "freq_update" ON friend_requests FOR UPDATE USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- friendships: own rows only
DROP POLICY IF EXISTS "friendships_select" ON friendships;
CREATE POLICY "friendships_select" ON friendships FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "friendships_insert" ON friendships;
CREATE POLICY "friendships_insert" ON friendships FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);
DROP POLICY IF EXISTS "friendships_delete" ON friendships;
CREATE POLICY "friendships_delete" ON friendships FOR DELETE USING (auth.uid() = user_id);

-- groups: members can see their groups
DROP POLICY IF EXISTS "groups_select" ON groups;
CREATE POLICY "groups_select" ON groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM group_members WHERE group_id = groups.id AND user_id = auth.uid())
  OR owner_id = auth.uid()
);
DROP POLICY IF EXISTS "groups_insert" ON groups;
CREATE POLICY "groups_insert" ON groups FOR INSERT WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "groups_update" ON groups;
CREATE POLICY "groups_update" ON groups FOR UPDATE USING (auth.uid() = owner_id);

-- group_members
DROP POLICY IF EXISTS "gmembers_select" ON group_members;
CREATE POLICY "gmembers_select" ON group_members FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = group_members.group_id AND gm2.user_id = auth.uid())
);
DROP POLICY IF EXISTS "gmembers_insert" ON group_members;
CREATE POLICY "gmembers_insert" ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "gmembers_delete" ON group_members;
CREATE POLICY "gmembers_delete" ON group_members FOR DELETE USING (auth.uid() = user_id);

-- applications: own + friends' (visibility = friends) + group members' (visibility = groups/public)
DROP POLICY IF EXISTS "apps_select_own" ON applications;
CREATE POLICY "apps_select_own"     ON applications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "apps_select_friends" ON applications;
CREATE POLICY "apps_select_friends" ON applications FOR SELECT USING (
  visibility IN ('friends', 'public') AND
  EXISTS (SELECT 1 FROM friendships WHERE user_id = auth.uid() AND friend_id = applications.user_id)
);
DROP POLICY IF EXISTS "apps_select_groups" ON applications;
CREATE POLICY "apps_select_groups"  ON applications FOR SELECT USING (
  visibility IN ('groups', 'public') AND
  EXISTS (
    SELECT 1 FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = applications.user_id
  )
);
DROP POLICY IF EXISTS "apps_insert" ON applications;
CREATE POLICY "apps_insert" ON applications FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "apps_update" ON applications;
CREATE POLICY "apps_update" ON applications FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "apps_delete" ON applications;
CREATE POLICY "apps_delete" ON applications FOR DELETE USING (auth.uid() = user_id);

-- notifications: recipient only
DROP POLICY IF EXISTS "notif_select" ON notifications;
CREATE POLICY "notif_select" ON notifications FOR SELECT USING (auth.uid() = recipient_id);
DROP POLICY IF EXISTS "notif_update" ON notifications;
CREATE POLICY "notif_update" ON notifications FOR UPDATE USING (auth.uid() = recipient_id);
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (true); -- server inserts

-- ============================================================
-- REALTIME
-- Enable realtime on tables needed for live feed updates
-- ============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE applications;
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;
EXCEPTION WHEN OTHERS THEN null; END $$;
