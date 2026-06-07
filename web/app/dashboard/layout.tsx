"use client"

import Navbar from "@/components/layout/Navbar"
import Sidebar from "@/components/layout/Sidebar"
import { EtherealShadow } from "@/components/ui/etheral-shadow"
import { UserProvider } from "@/lib/context/UserContext"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <UserProvider>
      <div className="min-h-screen relative">
        {/* Dark mode: Ethereal shadow animated background */}
        {isDark && (
          <div className="fixed inset-0 z-0 pointer-events-none">
            <EtherealShadow
              color="rgba(59, 100, 220, 0.7)"
              animation={{ scale: 100, speed: 90 }}
              noise={{ opacity: 0.6, scale: 1.2 }}
              sizing="fill"
              style={{ width: "100%", height: "100%" }}
            />
            <div className="absolute inset-0 bg-[hsl(224,28%,8%)]/75" />
          </div>
        )}

        {/* Light mode: soft gradient */}
        {!isDark && mounted && (
          <div
            className="fixed inset-0 z-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 120% 80% at 10% 0%, hsl(213 100% 96%) 0%, hsl(210 40% 98%) 50%, hsl(218 100% 96%) 100%)",
            }}
          />
        )}

        <Navbar />
        <Sidebar />

        <main className="relative z-10 pt-16 pl-60 min-h-screen transition-all duration-300">
          <div className="p-6 max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </UserProvider>
  )
}
