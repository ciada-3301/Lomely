"use client";

import React, { useState } from "react";
import { X, UserPlus, Copy, Check, AlertCircle } from "lucide-react";

interface InviteModalProps {
  roomCode: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function InviteModal({ roomCode, isOpen, onClose }: InviteModalProps) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const roomUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${roomCode}` : `lomely.app/room/${roomCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setStatusMessage(null);
    setIsError(false);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setIsError(true);
        setStatusMessage(data.error || "Failed to invite user");
      } else {
        setIsError(false);
        setStatusMessage(data.message || `Invitation sent to @${username}`);
        setUsername("");
      }
    } catch (err: any) {
      setIsError(true);
      setStatusMessage(err.message || "Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-md clay-card-elevated p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">
              Invite to Room
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Direct link copy */}
          <div>
            <label className="block text-xs text-zinc-300 font-medium mb-1.5">
              Room Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={roomUrl}
                className="flex-1 px-3.5 py-2 text-xs clay-input select-all"
              />
              <button
                onClick={handleCopy}
                className="clay-btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Invite by Username */}
          <form onSubmit={handleInvite}>
            <label className="block text-xs text-zinc-300 font-medium mb-1.5">
              Invite by @Username (Closed Room Access)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username..."
                className="flex-1 px-3.5 py-2 text-xs clay-input"
              />
              <button
                type="submit"
                disabled={loading || !username.trim()}
                className="clay-btn-primary px-4 py-2 text-xs disabled:opacity-40"
              >
                {loading ? "Inviting..." : "Invite"}
              </button>
            </div>
          </form>

          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                isError
                  ? "bg-red-950/40 border border-red-900/50 text-red-300"
                  : "bg-emerald-950/40 border border-emerald-900/50 text-emerald-300"
              }`}
            >
              {isError && <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
