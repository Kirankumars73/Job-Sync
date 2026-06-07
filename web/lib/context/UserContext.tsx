"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types/database"
import type { User } from "@supabase/supabase-js"

interface UserContextValue {
  user:    User    | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const UserContext = createContext<UserContextValue>({
  user:    null,
  profile: null,
  loading: true,
  signOut: async () => {},
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User    | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Initial session load
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()
        setProfile(data)
      }
      setLoading(false)
    })

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single()
          setProfile(data)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <UserContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
