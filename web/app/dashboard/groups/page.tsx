"use client"

import { Building2, Check, Crown, Hash, LogOut, Plus, Users } from "lucide-react"
import { useState, useEffect, useTransition, useCallback } from "react"
import { cn } from "@/lib/utils"
import { LiquidButton } from "@/components/ui/liquid-glass-button"
import { useUser } from "@/lib/context/UserContext"
import { createGroup, joinGroup, getMyGroups, leaveGroup } from "@/app/actions/groups"

type GroupEntry = {
  id: string; name: string; description: string | null
  group_code: string; owner_id: string; role: string
  member_count: number; is_owner: boolean; created_at: string
}

const groupGradients = [
  "from-blue-400 to-indigo-600",
  "from-violet-400 to-purple-600",
  "from-emerald-400 to-teal-600",
  "from-rose-400 to-pink-600",
  "from-amber-400 to-orange-500",
]

export default function GroupsPage() {
  const { user, profile } = useUser()
  const [tab, setTab] = useState<"my" | "create" | "join">("my")
  const [groups, setGroups] = useState<GroupEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const [groupName, setGroupName] = useState("")
  const [groupDesc, setGroupDesc] = useState("")
  const [joinCode,  setJoinCode]  = useState("")
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getMyGroups()
    setGroups((data.filter(Boolean) as unknown) as GroupEntry[])
    setLoading(false)
  }, [])

  useEffect(() => { if (user) refresh() }, [user, refresh])

  const showMsg = (type: "success" | "error", text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await createGroup(groupName, groupDesc)
      if (result?.error) { showMsg("error", result.error); return }
      showMsg("success", `Group created! Code: ${(result as {group_code?: string}).group_code}`)
      setGroupName(""); setGroupDesc("")
      setTab("my"); refresh()
    })
  }

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await joinGroup(joinCode)
      if (result?.error) { showMsg("error", result.error); return }
      showMsg("success", `Joined ${(result as {group_name?: string}).group_name}!`)
      setJoinCode(""); setTab("my"); refresh()
    })
  }

  const handleLeave = (groupId: string) => {
    startTransition(async () => {
      const result = await leaveGroup(groupId)
      if (result?.error) { showMsg("error", result.error); return }
      setGroups((prev) => prev.filter((g) => g.id !== groupId))
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Groups</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Coordinate job hunting with your cohort, bootcamp, or referral circle
        </p>
      </div>

      {/* Global message */}
      {msg && (
        <div className={cn(
          "flex items-center gap-2 p-3 rounded-xl text-sm slide-in",
          msg.type === "success"
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
            : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
        )}>
          {msg.type === "success" ? <Check className="w-4 h-4 shrink-0" /> : "⚠"}
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 glass rounded-xl w-fit">
        {(["my", "create", "join"] as const).map((t) => (
          <button key={t} id={`groups-tab-${t}`} onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
              tab === t ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "my" ? `My Groups (${groups.length})` : t === "create" ? "Create" : "Join"}
          </button>
        ))}
      </div>

      {/* My Groups */}
      {tab === "my" && (
        loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted/30 animate-pulse" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Building2 className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No groups yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-[220px]">
              Create a group for your batch or join one with a code
            </p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setTab("create")} className="px-4 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Create
              </button>
              <button onClick={() => setTab("join")} className="px-4 py-1.5 rounded-lg text-xs font-medium bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" /> Join
              </button>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((g, idx) => (
              <div key={g.id} className="glass-card p-5 hover-lift group">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-md", groupGradients[idx % groupGradients.length])}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {g.is_owner && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                        <Crown className="w-2.5 h-2.5" /> Owner
                      </span>
                    )}
                  </div>
                </div>
                <h3 className="font-semibold text-sm text-foreground leading-snug mb-1">{g.name}</h3>
                {g.description && <p className="text-[11px] text-muted-foreground mb-2 line-clamp-1">{g.description}</p>}
                <div className="flex items-center gap-1 mb-3">
                  <Hash className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono text-[11px] text-muted-foreground">{g.group_code}</span>
                  <button
                    className="ml-1 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => navigator.clipboard.writeText(g.group_code)}
                  >
                    copy
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5" /> {g.member_count} members
                  </div>
                  {!g.is_owner && (
                    <button
                      onClick={() => handleLeave(g.id)}
                      disabled={isPending}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30"
                    >
                      <LogOut className="w-3 h-3" /> Leave
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Create new CTA card */}
            <button onClick={() => setTab("create")}
              className="glass-card p-5 border-dashed hover-lift flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors min-h-[160px]">
              <div className="w-10 h-10 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">Create a group</span>
            </button>
          </div>
        )
      )}

      {/* Create Group */}
      {tab === "create" && (
        <div className="max-w-md">
          <div className="glass-card p-6">
            <h2 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Create a New Group
            </h2>
            <p className="text-xs text-muted-foreground mb-5">You&apos;ll get a unique group code to share with your crew.</p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="groups-name-input" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Group Name</label>
                <input id="groups-name-input" type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Batch 2025 — IIT Delhi" required maxLength={100} disabled={isPending}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all bg-muted/40 border border-border text-foreground placeholder-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="groups-desc-input" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Description <span className="normal-case text-muted-foreground/50">(optional)</span>
                </label>
                <textarea id="groups-desc-input" value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="What's this group about?" rows={3} maxLength={500} disabled={isPending}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all bg-muted/40 border border-border text-foreground placeholder-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20 resize-none disabled:opacity-60" />
              </div>
              <LiquidButton id="groups-create-btn" type="submit" size="default" disabled={isPending || !groupName.trim()} className="w-full h-10 text-foreground font-medium">
                {isPending ? <span className="w-4 h-4 border-2 border-muted/30 border-t-foreground rounded-full animate-spin" /> : <span className="flex items-center gap-1.5"><Plus className="w-4 h-4" /> Create Group</span>}
              </LiquidButton>
            </form>
          </div>
        </div>
      )}

      {/* Join Group */}
      {tab === "join" && (
        <div className="max-w-md">
          <div className="glass-card p-6">
            <h2 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
              <Hash className="w-4 h-4 text-primary" /> Join via Group Code
            </h2>
            <p className="text-xs text-muted-foreground mb-5">Ask the owner to share their group code.</p>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="groups-join-input" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Group Code</label>
                <input id="groups-join-input" type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="GROUP-XXXXXX" required disabled={isPending}
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none transition-all bg-muted/40 border border-border text-foreground placeholder-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20 tracking-widest disabled:opacity-60" />
              </div>
              <LiquidButton id="groups-join-btn" type="submit" size="default" disabled={isPending || joinCode.length < 6} className="w-full h-10 text-foreground font-medium">
                {isPending ? <span className="w-4 h-4 border-2 border-muted/30 border-t-foreground rounded-full animate-spin" /> : <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Join Group</span>}
              </LiquidButton>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
