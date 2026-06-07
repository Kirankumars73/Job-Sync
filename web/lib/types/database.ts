export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ApplicationStatus = 'applied' | 'oa_received' | 'interview' | 'offer' | 'rejected' | 'withdrawn' | 'no_response'
export type VisibilityLevel   = 'private' | 'friends' | 'groups' | 'public'
export type GroupMemberRole   = 'owner' | 'moderator' | 'member'
export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'
export type NotificationType  = 
  | 'friend_request_received' 
  | 'friend_request_accepted'
  | 'new_job_from_friend' 
  | 'new_job_in_group'
  | 'group_invite' 
  | 'group_member_joined' 
  | 'system_announcement'

export interface Profile {
  id:           string
  username:     string
  friend_code:  string
  avatar_url:   string | null
  bio:          string | null
  is_active:    boolean
  created_at:   string
  updated_at:   string
}

export interface Application {
  id:             string
  user_id:        string
  raw_url:        string
  canonical_url:  string
  canonical_hash: string
  company_name:   string | null
  role:           string | null
  job_location:   string | null
  applied_at:     string
  status:         ApplicationStatus
  notes:          string | null
  visibility:     VisibilityLevel
  link_active:    boolean
  created_at:     string
  updated_at:     string
}

export interface FriendRequest {
  id:          string
  sender_id:   string
  receiver_id: string
  status:      FriendRequestStatus
  created_at:  string
  updated_at:  string
  // joined
  sender?:     Profile
  receiver?:   Profile
}

export interface Friendship {
  id:         string
  user_id:    string
  friend_id:  string
  created_at: string
  // joined
  friend?:    Profile
}

export interface Group {
  id:           string
  name:         string
  description:  string | null
  group_code:   string
  owner_id:     string
  is_active:    boolean
  max_members:  number
  created_at:   string
  updated_at:   string
  // joined
  member_count?: number
  is_owner?:     boolean
}

export interface GroupMember {
  id:        string
  group_id:  string
  user_id:   string
  role:      GroupMemberRole
  joined_at: string
  // joined
  profile?:  Profile
  group?:    Group
}

export interface Notification {
  id:           string
  recipient_id: string
  sender_id:    string | null
  type:         NotificationType
  entity_type:  string | null
  entity_id:    string | null
  message:      string | null
  is_read:      boolean
  read_at:      string | null
  created_at:   string
  // joined
  sender?:      Profile
}

// Supabase Database type (used in createClient generics)
export interface Database {
  public: {
    Tables: {
      profiles:        { Row: Profile;        Insert: Partial<Profile> & { id: string; username: string }; Update: Partial<Profile> }
      applications:    { Row: Application;    Insert: Pick<Application, 'user_id' | 'raw_url' | 'canonical_url' | 'canonical_hash'> & Partial<Omit<Application, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'raw_url' | 'canonical_url' | 'canonical_hash'>>; Update: Partial<Application> }
      friend_requests: { Row: FriendRequest;  Insert: Pick<FriendRequest, 'sender_id' | 'receiver_id'>; Update: Partial<FriendRequest> }
      friendships:     { Row: Friendship;     Insert: Pick<Friendship, 'user_id' | 'friend_id'>; Update: never }
      groups:          { Row: Group;          Insert: Pick<Group, 'name' | 'owner_id'> & { description?: string }; Update: Partial<Group> }
      group_members:   { Row: GroupMember;    Insert: Pick<GroupMember, 'group_id' | 'user_id' | 'role'>; Update: Partial<GroupMember> }
      notifications:   { Row: Notification;   Insert: Omit<Notification, 'id' | 'created_at'>; Update: Partial<Notification> }
    }
    Views:   {}
    Functions: {}
    Enums: {
      application_status:    ApplicationStatus
      visibility_level:      VisibilityLevel
      group_member_role:     GroupMemberRole
      friend_request_status: FriendRequestStatus
      notification_type:     NotificationType
    }
  }
}
