"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function sendFriendRequest(friendCode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: target } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("friend_code", friendCode.trim().toUpperCase())
    .single()

  const t = target as { id: string; username: string } | null
  if (!t) return { error: "No user found with that friend code" }
  if (t.id === user.id) return { error: "That's your own friend code!" }

  const { data: existing } = await supabase
    .from("friendships")
    .select("id")
    .eq("user_id", user.id)
    .eq("friend_id", t.id)
    .single()

  if (existing) return { error: `You're already friends with ${t.username}` }

  const { data: pending } = await supabase
    .from("friend_requests")
    .select("id, status")
    .eq("sender_id", user.id)
    .eq("receiver_id", t.id)
    .single()

  const p = pending as { id: string; status: string } | null
  if (p?.status === "pending") return { error: "Friend request already sent!" }

  const { error } = await supabase
    .from("friend_requests")
    .insert({ sender_id: user.id, receiver_id: t.id } as never)

  return error ? { error: error.message } : { success: true, username: t.username }
}

export async function acceptFriendRequest(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: req } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("id", requestId)
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .single()

  const r = req as { sender_id: string } | null
  if (!r) return { error: "Request not found" }

  await supabase
    .from("friend_requests")
    .update({ status: "accepted" } as never)
    .eq("id", requestId)

  await supabase.from("friendships").insert([
    { user_id: user.id,      friend_id: r.sender_id },
    { user_id: r.sender_id, friend_id: user.id },
  ] as never)

  await supabase.from("notifications").insert({
    recipient_id: r.sender_id,
    sender_id:    user.id,
    type:         "friend_request_accepted",
    message:      "accepted your friend request",
  } as never)

  return { success: true }
}

export async function rejectFriendRequest(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "rejected" } as never)
    .eq("id", requestId)
    .eq("receiver_id", user.id)

  return error ? { error: error.message } : { success: true }
}

export async function getMyFriends() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from("friendships")
    .select("*, friend:profiles!friendships_friend_id_fkey(id, username, friend_code, avatar_url)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (data ?? []) as Record<string, unknown>[]
}

export async function getPendingRequests() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from("friend_requests")
    .select("*, sender:profiles!friend_requests_sender_id_fkey(id, username, avatar_url)")
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  return (data ?? []) as Record<string, unknown>[]
}

export async function removeFriend(friendId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  await supabase.from("friendships").delete().match({ user_id: user.id, friend_id: friendId } as never)
  await supabase.from("friendships").delete().match({ user_id: friendId, friend_id: user.id } as never)

  return { success: true }
}
