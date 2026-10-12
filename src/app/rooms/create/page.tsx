"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Plus, Globe, Lock, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function CreateRoomPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, isPublic }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create room");

      router.push(`/room/${data.room.code}`);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-16">
      <div className="w-full max-w-lg">
        <Link
          href="/rooms"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Rooms
        </Link>

        <div className="clay-card-elevated p-8 space-y-6">
          <div>
            <span className="clay-pill px-3 py-1 text-[11px] text-brand-400 font-medium">
              Host Setup
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-2">
              Create a Room
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Set up your space. You can invite friends and change visibility at any time.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/50 flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                Room Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cinema Lounge"
                className="w-full px-3.5 py-2.5 clay-input text-xs"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                Description (Optional)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What are we streaming today?"
                className="w-full px-3.5 py-2.5 clay-input text-xs resize-none"
              />
            </div>

            {/* Privacy selection radio cards */}
            <div>
              <label className="block text-xs text-zinc-300 font-medium mb-2">
                Room Visibility
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={`p-4 text-left transition-all rounded-2xl ${
                    isPublic
                      ? "clay-card border-brand-500/40 bg-clay-elevated"
                      : "clay-card opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className={`w-4 h-4 ${isPublic ? "text-brand-400" : "text-zinc-500"}`} />
                    <span className="text-xs font-bold text-white">Public</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Visible to all registered users.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={`p-4 text-left transition-all rounded-2xl ${
                    !isPublic
                      ? "clay-card border-amber-500/40 bg-clay-elevated"
                      : "clay-card opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className={`w-4 h-4 ${!isPublic ? "text-amber-400" : "text-zinc-500"}`} />
                    <span className="text-xs font-bold text-white">Closed</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Invite-only by @username.
                  </p>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-3 px-4 clay-btn-primary text-xs flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
            >
              {loading ? "Creating..." : "Launch Room"}
              <Plus className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
