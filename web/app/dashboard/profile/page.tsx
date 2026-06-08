"use client"

import {
  Briefcase, Building2, CheckCircle2, Clock, Copy, Edit3,
  TrendingUp, User, XCircle, Zap,
} from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/context/UserContext"
import { updateApplicationStatus } from "@/app/actions/applications"
import { supabase } from "@/lib/supabase/client"
import { getMyGroups } from "@/app/actions/groups"
import type { Application, Group } from "@/lib/types/database"

const statusColors: Record<string, string> = {
  applied:     "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  oa_received: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  interview:   "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  offer:       "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected:    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  withdrawn:   "bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400",
  no_response: "bg-gray-100 text-gray-400 dark:bg-gray-800/40 dark:text-gray-500",
}

const statusLabel: Record<string, string> = {
  applied: "Applied", oa_received: "OA", interview: "Interview",
  offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn", no_response: "No Response",
}

const filters = ["All", "applied", "oa_received", "interview", "offer", "rejected"]
const filterLabel: Record<string, string> = {
  All: "All", applied: "Applied", oa_received: "OA",
  interview: "Interview", offer: "Offer", rejected: "Rejected",
}

const breakdownItems = [
  { key: "applied",     label: "Applied",   color: "bg-blue-500"    },
  { key: "oa_received", label: "OA",        color: "bg-amber-500"   },
  { key: "interview",   label: "Interview", color: "bg-violet-500"  },
  { key: "offer",       label: "Offer",     color: "bg-emerald-500" },
  { key: "rejected",    label: "Rejected",  color: "bg-rose-500"    },
]

export default function ProfilePage() {
  const { user, profile, loading: userLoading } = useUser()
  const [copied, setCopied] = useState(false)
  const [activeFilter, setActiveFilter] = useState("All")
  const [apps,   setApps]   = useState<Application[]>([])
  const [groups, setGroups] = useState<{id: string; name: string; group_code: string; member_count: number; is_owner: boolean}[]>([])
  const [stats,  setStats]  = useState({ applied: 0, interview: 0, offer: 0, pending: 0 })
  const [loadingData, setLoadingData] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoadingData(true)

    // Applications — direct browser client query
    const { data: appsData, error: appsError } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (appsError) console.error("[profile refresh] apps error:", appsError)

    const myApps = (appsData ?? []) as Application[]
    setApps(myApps)
    setStats({
      applied:   myApps.length,
      interview: myApps.filter((a) => a.status === "interview").length,
      offer:     myApps.filter((a) => a.status === "offer").length,
      pending:   myApps.filter((a) => ["applied", "oa_received"].includes(a.status)).length,
    })

    // Groups — still via server action (needs complex join)
    const groupsData = await getMyGroups()
    setGroups((groupsData.filter(Boolean) as unknown) as typeof groups)

    setLoadingData(false)
  }, [user])

  useEffect(() => { if (user) refresh() }, [user, refresh])

  const handleCopy = () => {
    if (!profile) return
    navigator.clipboard.writeText(profile.friend_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingId(id)
    await updateApplicationStatus(id, status)
    setApps((prev) => prev.map((a) => a.id === id ? { ...a, status: status as Application["status"] } : a))
    setUpdatingId(null)
  }

  const filtered = activeFilter === "All"
    ? apps
    : apps.filter((a) => a.status === activeFilter)

  const total = apps.length

  return (
    <div className="space-y-6">

      {/* Profile header */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
            {userLoading ? "…" : (profile?.username?.[0]?.toUpperCase() ?? <User className="w-7 h-7" />)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-foreground">
                {userLoading ? "Loading…" : (profile?.username ?? "—")}
              </h1>
              <button className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Edit profile">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {profile ? `Joined ${new Date(profile.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}` : "—"}
            </p>
            <div className="flex flex-wrap gap-6">
              {[
                { label: "Applied",    value: stats.applied   },
                { label: "Interviews", value: stats.interview  },
                { label: "Offers",     value: stats.offer      },
                { label: "Friends",    value: "—"              },
                { label: "Groups",     value: groups.length    },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-base font-bold text-foreground">{loadingData ? "—" : value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Friend code */}
          <div className="shrink-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1 justify-end">
              <Zap className="w-3 h-3 text-amber-500" /> Friend Code
            </p>
            <div className="glass px-3 py-2 rounded-xl flex items-center gap-2">
              <span className={cn("font-mono text-sm font-bold text-foreground tracking-wider", userLoading && "opacity-30")}>
                {userLoading ? "XXXX-XXXX-XXXX" : (profile?.friend_code ?? "—")}
              </span>
              <button
                id="profile-copy-code-btn"
                onClick={handleCopy}
                disabled={!profile}
                className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                aria-label="Copy friend code"
              >
                {copied
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {copied && <p className="text-[10px] text-emerald-500 text-right mt-1">Copied!</p>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* Applications */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">All Applications</h2>
            <span className="ml-auto text-xs text-muted-foreground">{filtered.length} / {total} entries</span>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {filters.map((f) => (
              <button
                key={f}
                id={`profile-filter-${f}`}
                onClick={() => setActiveFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200",
                  activeFilter === f
                    ? "bg-primary text-white"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {filterLabel[f]}
              </button>
            ))}
          </div>

          {loadingData ? (
            <div className="space-y-2">
              {[1,2,3,4].map((i) => <div key={i} className="h-12 rounded-xl bg-muted/30 animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Briefcase className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {activeFilter === "All" ? "No applications yet" : `No ${filterLabel[activeFilter]} applications`}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((app) => (
                <div key={app.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors group">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-400/20 to-indigo-600/20 border border-border flex items-center justify-center text-xs font-bold text-foreground/60 shrink-0">
                    {(app.company_name ?? "?")[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{app.company_name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {app.role ?? (() => { try { return new URL(app.canonical_url).hostname } catch { return app.canonical_url } })()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Inline status changer */}
                    <select
                      value={app.status}
                      disabled={updatingId === app.id}
                      onChange={(e) => handleStatusChange(app.id, e.target.value)}
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full border-0 outline-none cursor-pointer transition-all",
                        statusColors[app.status],
                        updatingId === app.id && "opacity-50"
                      )}
                    >
                      {Object.entries(statusLabel).map(([k, v]) => (
                        <option key={k} value={k} className="text-foreground bg-background">{v}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(app.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </span>
                    <a href={app.raw_url} target="_blank" rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                      <Edit3 className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Groups */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-primary" /> My Groups
            </h2>
            {loadingData ? (
              <div className="h-16 rounded-xl bg-muted/30 animate-pulse" />
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Building2 className="w-7 h-7 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">Not in any groups yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((g) => (
                  <div key={g.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 cursor-pointer transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white shrink-0">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{g.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{g.group_code}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{g.member_count} members</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status breakdown */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" /> Status Breakdown
            </h2>
            <div className="space-y-2.5">
              {breakdownItems.map(({ key, label, color }) => {
                const count = apps.filter((a) => a.status === key).length
                const pct   = total > 0 ? (count / total) * 100 : 0
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-semibold text-foreground">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Account info */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-primary" /> Account
            </h2>
            <div className="space-y-2">
              {[
                { label: "Username",     value: profile?.username ?? "—" },
                { label: "Member since", value: profile ? new Date(profile.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
