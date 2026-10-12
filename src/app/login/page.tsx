"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, AlertCircle, Lock, User, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requiresOtp, setRequiresOtp] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requiresVerification) {
          setRequiresOtp(true);
          setOtpEmail(data.email);
          await fetch("/api/auth/resend-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: data.email }),
          });
          return;
        }
        throw new Error(data.error || "Login failed");
      }

      await refreshUser();
      router.push("/rooms");
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, code: otpCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      await refreshUser();
      router.push("/rooms");
    } catch (err: any) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-16">
      <div className="w-full max-w-md">
        <div className="clay-card-elevated p-8 space-y-6">
          {!requiresOtp ? (
            <>
              <div>
                <span className="clay-pill px-3 py-1 text-[11px] text-brand-400 font-medium">
                  Authentication
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-white mt-2">
                  Welcome back
                </h1>
                <p className="text-xs text-zinc-400 mt-1">
                  Sign in with your username or email address.
                </p>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/50 flex items-start gap-2.5 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                    Username or Email
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Username or email"
                      className="w-full pl-9 pr-3.5 py-2.5 clay-input text-xs"
                    />
                    <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3.5 py-2.5 clay-input text-xs"
                    />
                    <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 clay-btn-primary text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? "Signing in..." : "Sign In"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="pt-4 border-t border-white/5 text-center text-xs text-zinc-400">
                Don't have an account yet?{" "}
                <Link href="/signup" className="text-brand-400 hover:underline font-medium">
                  Create one now
                </Link>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="clay-pill px-3 py-1 text-[11px] text-brand-400 font-medium">
                  Verification Required
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-white mt-2">
                  Verify your account
                </h1>
                <p className="text-xs text-zinc-400 mt-1">
                  We sent a 6-digit code to <span className="text-white font-medium">{otpEmail}</span>.
                </p>
              </div>



              {error && (
                <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/50 flex items-start gap-2.5 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-300 font-medium mb-2 text-center">
                    Enter 6-Digit Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full text-center text-2xl tracking-[8px] py-3.5 clay-input font-bold"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full py-3 px-4 clay-btn-primary text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </form>

              <div className="pt-4 border-t border-white/5 text-center">
                <button
                  type="button"
                  onClick={() => setRequiresOtp(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Back to Sign In
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
