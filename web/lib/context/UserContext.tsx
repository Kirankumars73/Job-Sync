"use client"

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react"
import { supabase } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types/database"
import type { SupabaseClient, User } from "@supabase/supabase-js"

interface UserContextValue {
  supabase: SupabaseClient
  user:    User    | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refetchProfile: () => Promise<void>
}

const UserContext = createContext<UserContextValue>({
  supabase,
  user:          null,
  profile:       null,
  loading:       true,
  signOut:       async () => {},
  refetchProfile: async () => {},
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User    | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchingRef = useRef(false)

  const fetchProfile = async (userId: string) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()
      if (!error && data) {
        setProfile(data as Profile)
      } else {
        // Retry once after 800ms (handles race between signUp and profile insert)
        await new Promise((r) => setTimeout(r, 800))
        const { data: retry } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single()
        setProfile((retry as Profile) ?? null)
      }
    } finally {
      fetchingRef.current = false
    }
  }

  const refetchProfile = async () => {
    if (!user) return
    await fetchProfile(user.id)
  }

  useEffect(() => {
    // onAuthStateChange is the single source of truth.
    // It fires immediately with INITIAL_SESSION on mount.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          fetchProfile(currentUser.id).finally(() => setLoading(false))
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <UserContext.Provider value={{ supabase, user, profile, loading, signOut, refetchProfile }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
