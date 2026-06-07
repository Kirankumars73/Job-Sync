"use client"

import { ShaderAnimation } from "@/components/ui/shader-animation"
import { LiquidButton } from "@/components/ui/liquid-glass-button"
import { Briefcase, Eye, EyeOff, Lock, User, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"
import { signIn } from "@/app/actions/auth"

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await signIn(formData)
      if (result?.error) setError(result.error)
      // On success, signIn() calls redirect("/dashboard") server-side
    })
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 z-0">
        <ShaderAnimation />
      </div>
      <div className="absolute inset-0 z-[1] bg-gradient-to-br from-black/30 via-transparent to-black/20 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md mx-4 fade-up">
        <div className="glass-card p-8 sm:p-10">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none">JobSync</h1>
              <p className="text-[11px] text-white/60 mt-0.5">Collaborate on your job hunt</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Welcome back</h2>
            <p className="text-sm text-white/60 mt-1">Sign in to your account to continue</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 mb-4 slide-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <p className="text-sm text-rose-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="login-username" className="text-xs font-medium text-white/70 uppercase tracking-wide">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  placeholder="your_username"
                  autoComplete="username"
                  required
                  disabled={isPending}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all duration-200
                    bg-white/10 border border-white/20
                    focus:border-blue-400/60 focus:bg-white/15 focus:ring-2 focus:ring-blue-400/20
                    hover:border-white/30 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-xs font-medium text-white/70 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={isPending}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all duration-200
                    bg-white/10 border border-white/20
                    focus:border-blue-400/60 focus:bg-white/15 focus:ring-2 focus:ring-blue-400/20
                    hover:border-white/30 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <LiquidButton
                id="login-submit-btn"
                type="submit"
                size="xl"
                disabled={isPending}
                className="w-full text-white font-semibold text-base"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : "Sign In"}
              </LiquidButton>
            </div>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/15" />
            <span className="text-xs text-white/40">or</span>
            <div className="flex-1 h-px bg-white/15" />
          </div>

          <p className="text-center text-sm text-white/50">
            New to JobSync?{" "}
            <Link href="/register" className="text-blue-300 hover:text-blue-200 font-medium transition-colors">
              Create an account
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-white/30 mt-4">
          Your applications. Your friends. Zero noise.
        </p>
      </div>
    </div>
  )
}
