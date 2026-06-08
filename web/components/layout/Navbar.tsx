"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import SkyToggle from "@/components/ui/sky-toggle"
import { useUser } from "@/lib/context/UserContext"
import { signOut } from "@/app/actions/auth"
import { Bell, Briefcase, ChevronDown, LogOut, Settings, User, Zap } from "lucide-react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Notification } from "@/lib/types/database"

const navLinks = [
  { href: "/dashboard",          label: "Dashboard" },
  { href: "/dashboard/friends",  label: "Friends"   },
  { href: "/dashboard/groups",   label: "Groups"    },
  { href: "/dashboard/profile",  label: "Profile"   },
]

export default function Navbar() {
  const pathname = usePathname()
  const { user, profile, loading } = useUser()
  const [notifOpen,   setNotifOpen]   = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount,   setUnreadCount]   = useState(0)

  // Load + subscribe to notifications
  useEffect(() => {
    const uid = profile?.id ?? user?.id
    if (!uid) return
    const supabase = createClient()

    // Initial fetch
    supabase
      .from("notifications")
      .select("*, sender:profiles!notifications_sender_id_fkey(username)")
      .eq("recipient_id", uid)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) {
          setNotifications(data as Notification[])
          setUnreadCount(data.filter((n) => !n.is_read).length)
        }
      })

    // Real-time subscription
    const channel = supabase
      .channel("notifications-" + uid)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${uid}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev.slice(0, 9)])
          setUnreadCount((c) => c + 1)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id ?? user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const markAllRead = async () => {
    const uid = profile?.id ?? user?.id
    if (!uid) return
    const supabase = createClient()
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("recipient_id", uid)
      .eq("is_read", false)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  // Show username from profile; fall back to email prefix from user metadata while profile loads
  const displayName = profile?.username
    ?? (user?.user_metadata?.username as string | undefined)
    ?? (loading ? null : "Account")

  const avatarInitial = displayName?.[0]?.toUpperCase() ?? (loading ? "…" : "?")

  const notifTypeLabel: Record<string, string> = {
    friend_request_received:  "sent you a friend request",
    friend_request_accepted:  "accepted your friend request",
    new_job_from_friend:      "added a new job application",
    new_job_in_group:         "added a job in your group",
    group_invite:             "invited you to a group",
    group_member_joined:      "joined your group",
    system_announcement:      "",
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <Briefcase className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight gradient-text hidden sm:block">JobSync</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                pathname === link.href
                  ? "bg-primary/10 text-primary dark:bg-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          <SkyToggle />

          {/* Notification bell */}
          <div className="relative">
            <button
              id="navbar-notifications-btn"
              onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false) }}
              className="relative w-9 h-9 rounded-xl glass flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-blue-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center px-1">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 glass-card p-4 slide-in z-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-primary hover:text-primary/80 transition-colors">
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <Bell className="w-8 h-8 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">No notifications yet</p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors",
                          n.is_read ? "hover:bg-muted/30" : "bg-primary/5 hover:bg-primary/10"
                        )}
                      >
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5">
                          {(n as {sender?: {username?: string}}).sender?.username?.[0]?.toUpperCase() ?? "JS"}
                        </div>
                        <div>
                          <p className="text-xs text-foreground leading-snug">
                            <span className="font-medium">{(n as {sender?: {username?: string}}).sender?.username ?? "JobSync"}</span>{" "}
                            {notifTypeLabel[n.type] ?? n.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                          </p>
                        </div>
                        {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5 ml-auto" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profile dropdown */}
          <div className="relative">
            <button
              id="navbar-profile-btn"
              onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false) }}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl glass hover:bg-muted/40 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {loading && !displayName ? "…" : avatarInitial}
              </div>
              <span className="text-sm font-medium hidden sm:block max-w-[100px] truncate">
                {loading && !displayName
                  ? <span className="inline-block w-16 h-3 rounded bg-muted/60 animate-pulse" />
                  : displayName}
              </span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0", profileOpen && "rotate-180")} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-12 w-48 glass-card py-1 slide-in z-50">
                {profile && (
                  <div className="px-3 py-2 border-b border-border/40 mb-1">
                    <p className="text-xs font-semibold text-foreground">{profile.username}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Zap className="w-2.5 h-2.5 text-amber-500" />
                      <span className="font-mono text-[10px] text-muted-foreground">{profile.friend_code}</span>
                    </div>
                  </div>
                )}
                <Link href="/dashboard/profile" className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors" onClick={() => setProfileOpen(false)}>
                  <User className="w-4 h-4 text-muted-foreground" /> Profile
                </Link>
                <Link href="/dashboard/profile" className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors" onClick={() => setProfileOpen(false)}>
                  <Settings className="w-4 h-4 text-muted-foreground" /> Settings
                </Link>
                <div className="border-t border-border/50 mt-1 pt-1">
                  <form action={signOut}>
                    <button type="submit" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
