import { useState, type FormEvent } from "react";
import {
  Eye,
  EyeOff,
  Sparkles,
  LoaderCircle,
  LogIn,
  UserPlus,
  MailCheck,
  RefreshCw,
} from "lucide-react";
import { loginUser, resendFirebaseVerification } from "../api/auth.api";

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
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setNeedsVerification(false);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      await loginUser({ email: normalizedEmail, password });
      onLogin();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in.";
      setError(message);
      if (/verify your email|verification link/i.test(message)) {
        setNeedsVerification(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setError("");
    setNotice("");
    setSendingVerification(true);
    try {
      await resendFirebaseVerification();
      setNotice("Verification link sent. Check your inbox and spam folder.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send the verification link.");
    } finally {
      setSendingVerification(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-white">
      <div className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 size-96 rounded-full bg-indigo-600/20 blur-3xl" />

      <section className="relative w-full max-w-md">
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

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
          <div className="mb-7">
            <h2 className="text-xl font-bold">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-400">
              Sign in to continue to your workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">
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
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">
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
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-white"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" aria-live="polite" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm leading-5 text-rose-300">
                {error}
              </div>
            )}
            {notice && (
              <div role="status" aria-live="polite" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm leading-5 text-emerald-300">
                {notice}
              </div>
            )}

            {needsVerification && (
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
                <div className="flex items-start gap-3">
                  <MailCheck size={20} className="mt-0.5 shrink-0 text-violet-300" />
                  <div>
                    <p className="text-sm font-semibold text-violet-200">Email verification required</p>
                    <p className="mt-1 text-sm leading-5 text-slate-300">
                      If you have just signed in, use the button below to resend the verification link.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={sendingVerification}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/40 px-4 py-3 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/10 disabled:opacity-60"
                >
                  {sendingVerification ? <LoaderCircle size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                  {sendingVerification ? "Sending link..." : "Resend verification link"}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:from-violet-500 hover:to-indigo-500 focus:outline-none focus:ring-4 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <LoaderCircle size={18} className="animate-spin" /> : <LogIn size={18} />}
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="my-6 border-t border-slate-800" />
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-violet-500/50 hover:bg-violet-500/5"
          >
            <UserPlus size={17} />
            Create an account
          </button>
        </div>
      </section>
    </main>
  );
}
