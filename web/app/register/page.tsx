"use client"

import { ShaderAnimation } from "@/components/ui/shader-animation"
import { LiquidButton } from "@/components/ui/liquid-glass-button"
import { AlertCircle, Briefcase, Eye, EyeOff, Lock, User } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"
import { signUp } from "@/app/actions/auth"

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await signUp(formData)
      if (result?.error) setError(result.error)
      // On success, signUp() calls redirect("/dashboard") server-side
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
            <h2 className="text-2xl font-bold text-white">Create account</h2>
            <p className="text-sm text-white/60 mt-1">Join your friends on JobSync</p>
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
              <label htmlFor="register-username" className="text-xs font-medium text-white/70 uppercase tracking-wide">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                <input
                  id="register-username"
                  name="username"
                  type="text"
                  placeholder="cool_username"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[a-zA-Z0-9_]+"
                  title="Letters, numbers, underscores only"
                  disabled={isPending}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all duration-200
                    bg-white/10 border border-white/20
                    focus:border-blue-400/60 focus:bg-white/15 focus:ring-2 focus:ring-blue-400/20
                    hover:border-white/30 disabled:opacity-60"
                />
              </div>
              <p className="text-[10px] text-white/30">Letters, numbers, underscores only · 3–30 chars</p>
            </div>


            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="register-password" className="text-xs font-medium text-white/70 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                <input
                  id="register-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={8}
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
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-white/30">Minimum 8 characters</p>
            </div>

            <div className="pt-2">
              <LiquidButton
                id="register-submit-btn"
                type="submit"
                size="xl"
                disabled={isPending}
                className="w-full text-white font-semibold text-base"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : "Create Account"}
              </LiquidButton>
            </div>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/15" />
            <span className="text-xs text-white/40">or</span>
            <div className="flex-1 h-px bg-white/15" />
          </div>

          <p className="text-center text-sm text-white/50">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-300 hover:text-blue-200 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-white/30 mt-4">
          You&apos;ll get a unique friend code automatically — no email required
        </p>
      </div>
    </div>
  )
}
