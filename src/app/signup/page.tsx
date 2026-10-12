"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Lock, Mail, User } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [step, setStep] = useState<"FORM" | "OTP">("FORM");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      setStep("OTP");
      startCooldown();
    } catch (err: any) {
      setError(err.message || "An error occurred");
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
        body: JSON.stringify({ email, code: otpCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      await refreshUser();
      router.push("/rooms");
    } catch (err: any) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const startCooldown = () => {
    setResendCooldown(30);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not resend code");
      startCooldown();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-16">
      <div className="w-full max-w-md">
        <div className="clay-card-elevated p-8 space-y-6">
          {step === "FORM" ? (
            <>
              <div>
                <span className="clay-pill px-3 py-1 text-[11px] text-brand-400 font-medium">
                  Welcome to Lomely
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-white mt-2">
                  Create your account
                </h1>
                <p className="text-xs text-zinc-400 mt-1">
                  Enter your details to receive your email verification code.
                </p>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/50 flex items-start gap-2.5 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. solomon"
                      className="w-full pl-9 pr-3.5 py-2.5 clay-input text-xs"
                    />
                    <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-9 pr-3.5 py-2.5 clay-input text-xs"
                    />
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
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
                      minLength={6}
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
                  {loading ? "Creating..." : "Continue to Verification"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="pt-4 border-t border-white/5 text-center text-xs text-zinc-400">
                Already registered?{" "}
                <Link href="/login" className="text-brand-400 hover:underline font-medium">
                  Sign in
                </Link>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="clay-pill px-3 py-1 text-[11px] text-brand-400 font-medium">
                  Verification
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-white mt-2">
                  Verify your email
                </h1>
                <p className="text-xs text-zinc-400 mt-1">
                  We sent a 6-digit code to <span className="text-white font-medium">{email}</span>.
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
                  {loading ? "Verifying..." : "Verify & Complete"}
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </form>

              <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
                <button
                  type="button"
                  onClick={() => setStep("FORM")}
                  className="hover:text-zinc-200"
                >
                  Change Email
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleResendOtp}
                  className="text-brand-400 hover:underline disabled:opacity-40 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend Code"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
