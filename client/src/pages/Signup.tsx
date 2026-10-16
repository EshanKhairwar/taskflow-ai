import { useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, Mail, Sparkles, ShieldCheck } from "lucide-react";
import { registerUser } from "../api/auth.api";

interface SignupPageProps {
  onSignup: () => void;
  onSwitchToLogin: () => void;
}

export default function SignupPage({ onSignup: _onSignup, onSwitchToLogin }: SignupPageProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError("Name must contain at least 2 characters.");
      return;
    }
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await registerUser({ name: name.trim(), email: email.trim().toLowerCase(), password });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />

      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-950/40">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">TaskFlow <span className="text-violet-400">AI</span></h1>
            <p className="text-xs text-slate-400">Plan smarter. Work better.</p>
          </div>
        </div>

        {success ? (
          <div className="py-4">
            <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300">
              <Mail size={28} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Check your inbox</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              We sent a verification link to <strong className="break-all text-white">{email.trim().toLowerCase()}</strong>.
              Open the email and click the link to verify your address. Check your spam folder too.
            </p>
            <div className="mt-5 flex gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-violet-300" />
              <p className="text-sm leading-5 text-slate-300">
                After verifying, return here and sign in with your email and password.
              </p>
            </div>
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3.5 text-sm font-bold text-white transition hover:from-violet-500 hover:to-indigo-500"
            >
              Go to sign in <ArrowRight size={17} />
            </button>
          </div>
        ) : (
          <>
            <div className="mb-7">
              <p className="mb-2 text-sm font-semibold text-violet-400">GET STARTED</p>
              <h2 className="text-3xl font-bold tracking-tight">Create your account</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Create your workspace account. We’ll email you a verification link.
              </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-5">
              <div>
                <label htmlFor="signup-name" className="mb-2 block text-sm font-medium text-slate-300">Full name</label>
                <input id="signup-name" autoComplete="name" required minLength={2} maxLength={80} value={name}
                  onChange={(event) => setName(event.target.value)} placeholder="Enter your name"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60" />
              </div>

              <div>
                <label htmlFor="signup-email" className="mb-2 block text-sm font-medium text-slate-300">Email address</label>
                <input id="signup-email" type="email" autoComplete="email" required maxLength={254} value={email}
                  onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60" />
              </div>

              <div>
                <label htmlFor="signup-password" className="mb-2 block text-sm font-medium text-slate-300">Password</label>
                <input id="signup-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72}
                  value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60" />
                <p className="mt-2 text-xs text-slate-500">Use at least 8 characters.</p>
              </div>

              {error && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}

              <button type="submit" disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-950/30 transition hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? <><LoaderCircle size={17} className="animate-spin" /> Creating account...</> : <>Create account <ArrowRight size={17} /></>}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 border-t border-slate-800 pt-5 text-center">
          <p className="text-sm text-slate-400">
            Already have an account?{" "}
            <button type="button" onClick={onSwitchToLogin} className="font-semibold text-violet-300 transition hover:text-violet-200">
              Sign in
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
