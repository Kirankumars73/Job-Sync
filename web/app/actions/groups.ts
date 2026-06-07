"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function createGroup(name: string, description: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: group, error } = await supabase
    .from("groups")
    .insert({ name: name.trim(), description: description.trim() || null, owner_id: user.id } as never)
    .select()
    .single()

  const g = group as { id: string; group_code: string } | null
  if (error || !g) return { error: error?.message ?? "Failed to create group" }

  await supabase.from("group_members").insert({
    group_id: g.id,
    user_id:  user.id,
    role:     "owner",
  } as never)

  return { success: true, group_code: g.group_code }
}

export async function joinGroup(groupCode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, max_members")
    .eq("group_code", groupCode.trim().toUpperCase())
    .eq("is_active", true)
    .single()

  const g = group as { id: string; name: string; max_members: number } | null
  if (!g) return { error: "No active group found with that code" }

  const { data: membership } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", g.id)
    .eq("user_id", user.id)
    .single()

  if (membership) return { error: "You're already in this group!" }

  const { count } = await supabase
    .from("group_members")
    .select("id", { count: "exact" })
    .eq("group_id", g.id)

  if (count && count >= g.max_members) return { error: "This group is full" }

  const { error } = await supabase.from("group_members").insert({
    group_id: g.id,
    user_id:  user.id,
    role:     "member",
  } as never)

  return error ? { error: error.message } : { success: true, group_name: g.name }
}

export async function getMyGroups() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from("group_members")
    .select(`role, joined_at, group:groups(id, name, description, group_code, owner_id, created_at)`)
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })

  if (!data) return []

  type GroupRow = {
    role: string
    joined_at: string
    group: { id: string; name: string; description: string | null; group_code: string; owner_id: string; created_at: string } | { id: string; name: string; description: string | null; group_code: string; owner_id: string; created_at: string }[] | null
  }
  const rows = (data as unknown) as GroupRow[]

  const result = await Promise.all(
    rows.map(async (m) => {
      if (!m.group) return null
      // Supabase may return the joined relation as array or single object
      const grp = Array.isArray(m.group) ? m.group[0] : m.group
      if (!grp) return null
      const { count } = await supabase
        .from("group_members")
        .select("id", { count: "exact" })
        .eq("group_id", grp.id)
      return {
        ...grp,
        role:         m.role,
        joined_at:    m.joined_at,
        member_count: count ?? 0,
        is_owner:     grp.owner_id === user.id,
      }
    })
  )

  return result.filter(Boolean)
}

export async function leaveGroup(groupId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id)

  return error ? { error: error.message } : { success: true }
}
