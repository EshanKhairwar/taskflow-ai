
import { useState } from "react";
import type { FormEvent } from "react";
import {
  Eye,
  EyeOff,
  Sparkles,
  LoaderCircle,
  LogIn,
  UserPlus,
} from "lucide-react";
import { loginUser } from "../api/auth.api";

interface LoginPageProps {
  onLogin: () => void;
  onSwitchToSignup: () => void;
}

export default function LoginPage({
  onLogin,
  onSwitchToSignup,
}: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      await loginUser({
        email: normalizedEmail,
        password,
      });

      // The backend should set the HTTP-only token cookie
      // before the login request resolves successfully.
      onLogin();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-white">
      {/* Background decoration */}
      <div className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 size-96 rounded-full bg-indigo-600/20 blur-3xl" />

      <section className="relative w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40">
            <Sparkles size={27} />
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            TaskFlow <span className="text-violet-400">AI</span>
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Organize your projects. Focus on what matters.
          </p>
        </div>

        {/* Login form */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
          <div className="mb-7">
            <h2 className="text-xl font-bold">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-400">
              Sign in to continue to your workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Email address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                />

                <button
                  type="button"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  aria-pressed={showPassword}
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm leading-5 text-rose-300"
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:from-violet-500 hover:to-indigo-500 focus:outline-none focus:ring-4 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <LoaderCircle size={18} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign in to TaskFlow
                </>
              )}
            </button>
          </form>

          {/* Security message */}
          <div className="mt-6 border-t border-slate-800 pt-5">
            <p className="text-center text-xs leading-5 text-slate-500">
              Your workspace is protected by secure authentication.
            </p>
          </div>

          {/* Signup navigation */}
          <div className="mt-5 text-center">
            <p className="text-sm text-slate-400">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={onSwitchToSignup}
                className="inline-flex items-center gap-1 font-semibold text-violet-400 transition hover:text-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50 rounded-sm"
              >
                <UserPlus size={15} />
                Create account
              </button>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          © 2026 TaskFlow AI. Built for focused work.
        </p>
      </section>
    </main>
  );
}
