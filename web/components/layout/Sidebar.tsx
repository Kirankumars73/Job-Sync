"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/context/UserContext"
import { getApplicationStats } from "@/app/actions/applications"
import { LayoutDashboard, Users, Building2, User, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useState, useEffect } from "react"

const navItems = [
  { href: "/dashboard",         icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/dashboard/friends", icon: Users,           label: "Friends"              },
  { href: "/dashboard/groups",  icon: Building2,       label: "Groups"               },
  { href: "/dashboard/profile", icon: User,            label: "Profile"              },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { profile } = useUser()
  const [collapsed, setCollapsed] = useState(false)
  const [stats, setStats] = useState({ applied: 0, interview: 0, offer: 0 })

  useEffect(() => {
    if (!profile) return
    getApplicationStats().then((s) => {
      setStats({ applied: s.applied, interview: s.interview, offer: s.offer })
    })
  }, [profile])

  return (
    <aside
      className={cn(
        "glass-sidebar fixed left-0 top-16 h-[calc(100vh-4rem)] z-40 flex flex-col transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Collapse toggle */}
      <button
        id="sidebar-collapse-btn"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 w-6 h-6 glass rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform z-10"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3 text-muted-foreground" />
          : <ChevronLeft  className="w-3 h-3 text-muted-foreground" />}
      </button>

      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {navItems.map(({ href, icon: Icon, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                active
                  ? "bg-primary/10 text-primary dark:bg-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-110", active && "text-primary")} />
              {!collapsed && (
                <span className="truncate">{label}</span>
              )}
              {active && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 glass-card text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  {label}
                </div>
              )}
            </Link>
          )
        })}
      </div>

      {/* Stats + Add Job — only when expanded */}
      {!collapsed && (
        <div className="p-4 border-t border-border/40">
          {profile && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "Applied",    value: stats.applied,   color: "text-blue-500"    },
                { label: "Interviews", value: stats.interview,  color: "text-violet-500"  },
                { label: "Offers",     value: stats.offer,      color: "text-emerald-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center p-2 rounded-lg bg-muted/30">
                  <p className={cn("text-base font-bold", color)}>{value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Job
          </Link>
        </div>
      )}
    </aside>
  )
}
