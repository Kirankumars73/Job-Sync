"use client"

import {
  Check, Search, UserPlus, Users, X, UserMinus,
} from "lucide-react"
import { useState, useEffect, useTransition, useCallback } from "react"
import { cn } from "@/lib/utils"
import { LiquidButton } from "@/components/ui/liquid-glass-button"
import { useUser } from "@/lib/context/UserContext"
import {
  sendFriendRequest,
  getMyFriends,
  getPendingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
} from "@/app/actions/friends"
import type { Friendship, FriendRequest } from "@/lib/types/database"

export default function FriendsPage() {
  const { profile } = useUser()
  const [search, setSearch] = useState("")
  const [friendCode, setFriendCode] = useState("")
  const [isPending, startTransition] = useTransition()
  const [requestMsg, setRequestMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [friends,  setFriends]  = useState<Friendship[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [loading,  setLoading]  = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [f, r] = await Promise.all([getMyFriends(), getPendingRequests()])
    setFriends(f  as unknown as Friendship[])
    setRequests(r as unknown as FriendRequest[])
    setLoading(false)
  }, [])

  useEffect(() => { if (profile) refresh() }, [profile, refresh])

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault()
    if (!friendCode.trim()) return
    setRequestMsg(null)
    startTransition(async () => {
      const result = await sendFriendRequest(friendCode)
      if (result?.error) {
        setRequestMsg({ type: "error", text: result.error })
      } else {
        setRequestMsg({ type: "success", text: `Request sent to ${(result as {username?: string}).username ?? "user"}!` })
        setFriendCode("")
        setTimeout(() => setRequestMsg(null), 4000)
      }
    })
  }

  const handleAccept = (id: string) => {
    startTransition(async () => {
      await acceptFriendRequest(id)
      refresh()
    })
  }

  const handleReject = (id: string) => {
    startTransition(async () => {
      await rejectFriendRequest(id)
      setRequests((prev) => prev.filter((r) => r.id !== id))
    })
  }

  const handleRemove = (friendId: string) => {
    startTransition(async () => {
      await removeFriend(friendId)
      setFriends((prev) => prev.filter((f) => f.friend_id !== friendId))
    })
  }

  const filtered = friends.filter((f) => {
    const username = (f.friend as {username?: string})?.username ?? ""
    return username.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Friends</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {friends.length} connection{friends.length !== 1 ? "s" : ""} · see what they&apos;ve applied to
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left: Add friend + pending */}
        <div className="space-y-4">

          {/* Add friend card */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Add a Friend</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Enter their unique friend code to send a connection request.
            </p>

            {requestMsg && (
              <div className={cn(
                "flex items-center gap-2 p-2.5 rounded-lg text-xs mb-3 slide-in",
                requestMsg.type === "success"
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
              )}>
                {requestMsg.type === "success" ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                {requestMsg.text}
              </div>
            )}

            <form onSubmit={handleSendRequest} className="space-y-3">
              <input
                id="friends-code-input"
                type="text"
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                disabled={isPending}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200
                  bg-muted/40 border border-border text-foreground placeholder-muted-foreground
                  focus:border-primary/60 focus:ring-2 focus:ring-primary/20 font-mono tracking-widest
                  disabled:opacity-60"
              />
              <LiquidButton
                id="friends-send-request-btn"
                type="submit"
                size="default"
                disabled={isPending || friendCode.length < 5}
                className="w-full h-10 text-foreground font-medium"
              >
                {isPending ? (
                  <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
                ) : (
                  <span className="flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Send Request</span>
                )}
              </LiquidButton>
            </form>
          </div>

          {/* Pending requests */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              Pending Requests
              <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{requests.length}</span>
            </h2>

            {loading ? (
              <div className="h-12 rounded-xl bg-muted/30 animate-pulse" />
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Check className="w-7 h-7 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No pending requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => {
                  const sender = (req as {sender?: {username?: string; avatar_url?: string}}).sender
                  return (
                    <div key={req.id} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-400 to-rose-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {(sender?.username ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{sender?.username ?? "Unknown"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          id={`accept-${req.id}`}
                          onClick={() => handleAccept(req.id)}
                          disabled={isPending}
                          className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors flex items-center justify-center disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`reject-${req.id}`}
                          onClick={() => handleReject(req.id)}
                          disabled={isPending}
                          className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors flex items-center justify-center disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Friend list */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> My Friends
              <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{friends.length}</span>
            </h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                id="friends-search-input"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none bg-muted/40 border border-border text-foreground placeholder-muted-foreground focus:border-primary/60 w-36"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map((i) => <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {search ? "No friends match that search" : "No friends yet"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-[220px]">
                {!search && "Share your friend code with your job-hunting crew"}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((f) => {
                const friend = (f as {friend?: {username?: string}}).friend
                const username = friend?.username ?? "unknown"
                return (
                  <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
                      {username[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{username}</p>
                      <p className="text-xs text-muted-foreground">
                        Friends since {new Date(f.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <button
                      id={`remove-friend-${f.friend_id}`}
                      onClick={() => handleRemove(f.friend_id)}
                      disabled={isPending}
                      title="Remove friend"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-500 disabled:opacity-30"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
