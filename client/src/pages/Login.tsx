
import { useState } from "react";
import type { FormEvent } from "react";
import {
  Eye,
  EyeOff,
  Sparkles,
  LoaderCircle,
  LogIn,
  UserPlus,
  MailCheck,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { loginUser } from "../api/auth.api";
import { apiRequest } from "../api/client";

interface LoginPageProps {
  onLogin: () => void;
  onSwitchToSignup: () => void;
}

type VerificationResponse = {
  message?: string;
};

export default function LoginPage({
  onLogin,
  onSwitchToSignup,
}: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationMode, setVerificationMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

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

      onLogin();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to sign in.";

      setError(message);

      // Offer verification when login fails because the email is unverified.
      if (
        /verify your email|email.*not verified|not verified/i.test(message)
      ) {
        setVerificationMode(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setError("");
    setNotice("");

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address first.");
      return;
    }

    setOtpLoading(true);

    try {
      const response = await apiRequest<VerificationResponse>(
        "/auth/resend-verification",
        {
          method: "POST",
          body: JSON.stringify({ email: normalizedEmail }),
        },
      );

      setOtpSent(true);
      setNotice(
        response.message ??
          "If your account needs verification, a new code has been requested.",
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to request a verification code.",
      );
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!normalizedEmail) {
      setError("Enter your registered email address.");
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the complete six-digit verification code.");
      return;
    }

    setOtpLoading(true);

    try {
      const response = await apiRequest<VerificationResponse>(
        "/auth/verify-email",
        {
          method: "POST",
          body: JSON.stringify({
            email: normalizedEmail,
            otp,
          }),
        },
      );

      setVerificationMode(false);
      setOtpSent(false);
      setOtp("");
      setPassword("");
      setNotice(
        response.message ??
          "Email verified successfully. You can now log in.",
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Verification failed. Check your code and try again.",
      );
    } finally {
      setOtpLoading(false);
    }
  }

  function openVerification() {
    setError("");
    setNotice("");
    setOtp("");
    setOtpSent(false);
    setVerificationMode(true);
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
          {verificationMode ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setVerificationMode(false);
                  setError("");
                  setNotice("");
                }}
                className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
              >
                <ArrowLeft size={16} />
                Back to login
              </button>

              <div className="mb-7">
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
                  <MailCheck size={25} />
                </div>

                <h2 className="text-xl font-bold">Verify your email</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Request a verification code for your registered email, then
                  enter the six-digit OTP below.
                </p>
              </div>

              <div className="mb-5">
                <label
                  htmlFor="verification-email"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Email address
                </label>

                <input
                  id="verification-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  disabled={otpLoading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60"
                />
              </div>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={otpLoading}
                className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/40 px-4 py-3 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {otpLoading ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <RefreshCw size={17} />
                )}
                {otpSent ? "Resend verification code" : "Send verification code"}
              </button>

              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div>
                  <label
                    htmlFor="otp"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Six-digit OTP
                  </label>

                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    required
                    disabled={otpLoading}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] text-white outline-none transition placeholder:text-slate-700 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm leading-5 text-rose-300"
                  >
                    {error}
                  </div>
                )}

                {notice && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm leading-5 text-emerald-300"
                  >
                    {notice}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={otpLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:from-violet-500 hover:to-indigo-500 focus:outline-none focus:ring-4 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {otpLoading ? (
                    <LoaderCircle size={18} className="animate-spin" />
                  ) : (
                    <MailCheck size={18} />
                  )}
                  Verify email
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-7">
                <h2 className="text-xl font-bold">Welcome back</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Sign in to continue to your workspace.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
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
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60"
                  />
                </div>

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
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60"
                    />

                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((current) => !current)}
                      disabled={loading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm leading-5 text-rose-300"
                  >
                    {error}
                  </div>
                )}

                {notice && (
                  <div
                    role="status"
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm leading-5 text-emerald-300"
                  >
                    {notice}
                  </div>
                )}

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

              <button
                type="button"
                onClick={openVerification}
                className="mt-4 w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-violet-500/50 hover:bg-violet-500/5 hover:text-white"
              >
                Already registered? Verify email / Resend OTP
              </button>

              <div className="mt-6 border-t border-slate-800 pt-5">
                <p className="text-center text-xs leading-5 text-slate-500">
                  Your workspace is protected by secure authentication.
                </p>
              </div>

              <div className="mt-5 text-center">
                <p className="text-sm text-slate-400">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={onSwitchToSignup}
                    className="inline-flex items-center gap-1 rounded-sm font-semibold text-violet-400 transition hover:text-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    <UserPlus size={15} />
                    Create account
                  </button>
                </p>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          © 2026 TaskFlow AI. Built for focused work.
        </p>
      </section>
    </main>
  );
}
