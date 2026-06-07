"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { ApplicationStatus } from "@/lib/types/database"

// ── Utility: strip tracking params + normalize URL ────────────
function canonicalizeUrl(raw: string): string {
  try {
    const url = new URL(raw)
    const junk = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","ref","source","trk","tracking"]
    junk.forEach((p) => url.searchParams.delete(p))
    return url.origin.toLowerCase() + url.pathname.replace(/\/$/, "") + url.search
  } catch {
    return raw.trim()
  }
}

// ── Simple hash for duplicate detection ──────────────────────
function simpleHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0
  }
  return Math.abs(h).toString(36)
}

// ── Extract company name from URL (best-effort) ───────────────
function extractJobMeta(url: string): { company_name: string | null; role: string | null } {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "")
    const parts = hostname.split(".")
    const company_name = parts.length >= 2 ? parts[parts.length - 2] : null
    return {
      company_name: company_name ? company_name.charAt(0).toUpperCase() + company_name.slice(1) : null,
      role: null,
    }
  } catch {
    return { company_name: null, role: null }
  }
}

// ─────────────────────────────────────────────────────────────

export async function addApplication(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const rawUrl = (formData.get("url") as string)?.trim()
  if (!rawUrl) return { error: "Please enter a job URL" }

  const canonicalUrl  = canonicalizeUrl(rawUrl)
  const canonicalHash = simpleHash(canonicalUrl)
  const meta          = extractJobMeta(rawUrl)

  const { error } = await supabase.from("applications").insert({
    user_id:        user.id,
    raw_url:        rawUrl,
    canonical_url:  canonicalUrl,
    canonical_hash: canonicalHash,
    company_name:   meta.company_name,
    role:           meta.role,
    status:         "applied" as ApplicationStatus,
    visibility:     "friends",
  } as never)

  if (error) {
    if (error.code === "23505") return { error: "You already added this job!" }
    return { error: error.message }
  }
  return { success: true }
}

export async function getMyApplications() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (data ?? []) as Record<string, unknown>[]
}

export async function getApplicationStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { applied: 0, interview: 0, offer: 0, pending: 0 }

  const { data } = await supabase
    .from("applications")
    .select("status")
    .eq("user_id", user.id)

  const rows = (data ?? []) as { status: string }[]
  return {
    applied:   rows.length,
    interview: rows.filter((r) => r.status === "interview").length,
    offer:     rows.filter((r) => r.status === "offer").length,
    pending:   rows.filter((r) => ["applied", "oa_received"].includes(r.status)).length,
  }
}

export async function getFriendActivity() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: friendships } = await supabase
    .from("friendships")
    .select("friend_id")
    .eq("user_id", user.id)

  if (!friendships?.length) return []

  const friendIds = (friendships as { friend_id: string }[]).map((f) => f.friend_id)

  const { data } = await supabase
    .from("applications")
    .select("*, profiles:profiles!applications_user_id_fkey(username, avatar_url)")
    .in("user_id", friendIds)
    .in("visibility", ["friends", "public"])
    .order("created_at", { ascending: false })
    .limit(20)

  return (data ?? []) as Record<string, unknown>[]
}

export async function updateApplicationStatus(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { error } = await supabase
    .from("applications")
    .update({ status } as never)
    .eq("id", id)
    .eq("user_id", user.id)

  return error ? { error: error.message } : { success: true }
}

export async function deleteApplication(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  return error ? { error: error.message } : { success: true }
}
