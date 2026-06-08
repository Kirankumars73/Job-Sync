"use client"

import { LiquidButton } from "@/components/ui/liquid-glass-button"
import { useUser } from "@/lib/context/UserContext"
import { addApplication } from "@/app/actions/applications"
import {
  Briefcase, CheckCircle2, Clock, ExternalLink, Link2,
  Plus, TrendingUp, Users, Zap, RefreshCw,
} from "lucide-react"
import { useState, useEffect, useTransition, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { Application } from "@/lib/types/database"
import { createClient, supabase } from "@/lib/supabase/client"

const statusColors: Record<string, string> = {
  applied:      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  oa_received:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  interview:    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  offer:        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected:     "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  withdrawn:    "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400",
  no_response:  "bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400",
}

const statusLabel: Record<string, string> = {
  applied: "Applied", oa_received: "OA", interview: "Interview",
  offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn", no_response: "No Response",
}

export default function DashboardPage() {
  const { user, profile, loading: userLoading } = useUser()
  const [url, setUrl] = useState("")
  const [urlError, setUrlError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)

  const [apps, setApps] = useState<Application[]>([])
  const [friendActivity, setFriendActivity] = useState<(Application & { profiles?: { username: string } })[]>([])
  const [stats, setStats] = useState({ applied: 0, interview: 0, offer: 0, pending: 0 })
  const [loadingData, setLoadingData] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoadingData(true)

    // ── My Applications ──────────────────────────────────────
    const { data: appsData } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    const myApps = (appsData ?? []) as Application[]
    setApps(myApps)

    // ── Stats (derived from myApps) ───────────────────────────
    setStats({
      applied:   myApps.length,
      interview: myApps.filter((a) => a.status === "interview").length,
      offer:     myApps.filter((a) => a.status === "offer").length,
      pending:   myApps.filter((a) => ["applied", "oa_received"].includes(a.status)).length,
    })


    // ── Friend Activity ──────────────────────────────────────
    const { data: friendships } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", user.id)

    if (friendships?.length) {
      const friendIds = (friendships as { friend_id: string }[]).map((f) => f.friend_id)
      const { data: activityData } = await supabase
        .from("applications")
        .select("*, profiles:profiles!applications_user_id_fkey(username, avatar_url)")
        .in("user_id", friendIds)
        .in("visibility", ["friends", "public"])
        .order("created_at", { ascending: false })
        .limit(20)
      setFriendActivity((activityData ?? []) as unknown as (Application & { profiles?: { username: string } })[])
    } else {
      setFriendActivity([])
    }

    setLoadingData(false)
  }, [user])

  useEffect(() => {
    // Gate on user (auth), not profile — profile can lag behind briefly
    if (!user && !userLoading) return
    if (userLoading) return
    refresh()
  }, [user, userLoading, refresh])

  // Real-time: listen for new applications (own + friends')
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel("apps-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "applications" }, () => {
        refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, refresh])

  const handleAddJob = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setUrlError(null)
    if (!url.trim()) return
    const formData = new FormData()
    formData.set("url", url)
    startTransition(async () => {
      const result = await addApplication(formData)
      if (result?.error) { setUrlError(result.error); return }
      setSubmitted(true)
      setUrl("")
      setTimeout(() => setSubmitted(false), 3000)
      refresh()
    })
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting()}{profile ? <>, <span className="gradient-text">{profile.username}</span></> : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.applied > 0
              ? `${stats.applied} applications tracked · ${friendActivity.length} new from your network`
              : "Paste a job URL below to start tracking"}
          </p>
        </div>
        {profile && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs text-muted-foreground">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Code: <span className="font-mono font-semibold text-foreground">{profile.friend_code}</span></span>
          </div>
        )}
      </div>

      {/* Quick Add Job URL */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Add a Job Application</h2>
        </div>
        <form onSubmit={handleAddJob} className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              id="dashboard-job-url-input"
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(null) }}
              placeholder="https://jobs.company.com/role/12345"
              disabled={isPending}
              className={cn(
                "w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200",
                "bg-muted/40 border text-foreground placeholder-muted-foreground",
                "focus:ring-2 hover:border-primary/30 disabled:opacity-60",
                urlError
                  ? "border-rose-400/60 focus:ring-rose-400/20"
                  : "border-border focus:border-primary/60 focus:ring-primary/20"
              )}
            />
          </div>
          <LiquidButton
            id="dashboard-add-job-btn"
            type="submit"
            size="default"
            disabled={isPending || !url.trim()}
            className={cn("text-foreground font-medium px-5 h-10", submitted && "text-emerald-500")}
          >
            {isPending ? (
              <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
            ) : submitted ? (
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Saved!</span>
            ) : (
              <span className="flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Job</span>
            )}
          </LiquidButton>
        </form>
        {urlError && <p className="text-xs text-rose-500 mt-2 flex items-center gap-1">⚠ {urlError}</p>}
        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-500" />
          Tracking params stripped · Duplicates blocked · Visible to friends
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Applied", value: stats.applied,   icon: Briefcase,    color: "text-blue-500"    },
          { label: "Interviews",    value: stats.interview,  icon: TrendingUp,   color: "text-violet-500"  },
          { label: "Pending",       value: stats.pending,    icon: Clock,        color: "text-amber-500"   },
          { label: "Offers",        value: stats.offer,      icon: CheckCircle2, color: "text-emerald-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-4 hover-lift">
            <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-2">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <p className={cn("text-2xl font-bold", loadingData ? "text-muted-foreground/40" : color)}>
              {loadingData ? "—" : value}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-5 gap-6">

        {/* My Applications */}
        <div className="lg:col-span-3 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" /> My Applications
            </h2>
            <button onClick={refresh} className="text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
              <RefreshCw className={cn("w-3.5 h-3.5", loadingData && "animate-spin")} />
            </button>
          </div>

          {loadingData ? (
            <div className="space-y-2">
              {[1,2,3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : apps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                <Briefcase className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No applications yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Paste a job URL above to get started</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {apps.slice(0, 8).map((app) => (
                <div key={app.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors group cursor-pointer">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-400/20 to-indigo-600/20 border border-border flex items-center justify-center text-sm font-bold text-foreground/60 shrink-0">
                    {(app.company_name ?? "?")[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{app.company_name ?? "Unknown company"}</p>
                    <p className="text-xs text-muted-foreground truncate">{app.role ?? (() => { try { return new URL(app.canonical_url).hostname } catch { return app.canonical_url } })()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", statusColors[app.status])}>
                      {statusLabel[app.status]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(app.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </span>
                    <a href={app.raw_url} target="_blank" rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
              {apps.length > 8 && (
                <button className="w-full text-xs text-primary hover:text-primary/80 py-2 transition-colors">
                  View all {apps.length} applications →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Friend Activity */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Friend Activity</h2>
              {friendActivity.length > 0 && (
                <span className="ml-auto text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {friendActivity.length} new
                </span>
              )}
            </div>

            {loadingData ? (
              <div className="space-y-2">
                {[1,2].map((i) => <div key={i} className="h-12 rounded-xl bg-muted/30 animate-pulse" />)}
              </div>
            ) : friendActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs font-medium text-muted-foreground">No activity yet</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Add friends to see their applications</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friendActivity.slice(0, 5).map((app) => (
                  <div key={app.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/40 cursor-pointer transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(app.profiles?.username ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{app.profiles?.username}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        Applied to <span className="text-foreground font-medium">{app.company_name ?? "a company"}</span>
                        {app.role && <> · {app.role}</>}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(app.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                    <a href={app.raw_url} target="_blank" rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Friend code card */}
          <div className="glass-card p-5 bg-gradient-to-br from-primary/5 to-indigo-500/5 dark:from-primary/10 dark:to-indigo-500/10">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Your Friend Code</h3>
            </div>
            <div className="font-mono text-xl font-bold text-foreground tracking-wider mb-3">
              {userLoading ? <span className="opacity-30">Loading…</span> : (profile?.friend_code ?? "—")}
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Share this with friends so they can add you without revealing your email
            </p>
            <button
              id="dashboard-copy-code-btn"
              className="w-full py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
              onClick={() => profile && navigator.clipboard.writeText(profile.friend_code)}
              disabled={!profile}
            >
              Copy code to clipboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
