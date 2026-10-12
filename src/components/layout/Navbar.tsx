"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Compass,
  MessageSquare,
  Shield,
  LogOut,
  Plus,
  Menu,
  X,
  Bell,
  Check,
  DoorOpen,
} from "lucide-react";

interface PendingInvite {
  id: string;
  roomId: string;
  invitedBy: string;
  createdAt: string;
  room: {
    id: string;
    code: string;
    name: string;
    isPublic: boolean;
    host: {
      username: string;
      avatarUrl?: string | null;
    };
  };
}

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Poll for pending room invites every 4 seconds when user is logged in
  useEffect(() => {
    if (!user) {
      setPendingInvites([]);
      return;
    }

    let isMounted = true;
    const fetchInvites = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.invites) {
            setPendingInvites(data.invites);
          }
        }
      } catch {}
    };

    fetchInvites();
    const interval = setInterval(fetchInvites, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  const handleInviteAction = async (inviteId: string, action: "ACCEPT" | "DECLINE") => {
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, action }),
      });
      if (res.ok) {
        const data = await res.json();
        setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
        if (action === "ACCEPT" && data.roomCode) {
          setNotificationsOpen(false);
          window.location.href = `/room/${data.roomCode}`;
        }
      }
    } catch (err) {
      console.error("Invite action error:", err);
    }
  };

  // When inside a room, hide website navigation completely to provide Google Meet immersive theater container
  if (pathname.startsWith("/room/")) {
    return null;
  }

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <header className="sticky top-0 z-40 w-full px-4 sm:px-6 lg:px-8 pt-3 pb-2 bg-background/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto h-14 clay-card px-4 sm:px-6 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="w-3 h-3 rounded-full bg-brand-500 shadow-glow group-hover:scale-110 transition-transform" />
            <span className="text-base font-bold tracking-tight text-white font-sans">
              Lomely
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5">
            <Link
              href="/rooms"
              className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-all ${
                isActive("/rooms")
                  ? "clay-pill text-brand-400 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Explore
            </Link>

            {user && (
              <Link
                href="/messages"
                className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-all ${
                  isActive("/messages")
                    ? "clay-pill text-brand-400 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Messages
              </Link>
            )}

            {user?.role === "ADMIN" && (
              <Link
                href="/admin"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-xl transition-all ${
                  isActive("/admin")
                    ? "clay-pill text-amber-400 font-semibold"
                    : "text-zinc-400 hover:text-amber-300"
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-amber-500" />
                Admin
              </Link>
            )}
          </nav>
        </div>

        {/* Action Controls & User Status */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/rooms/create"
                className="clay-btn-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New Room
              </Link>

              {/* Notification Bell with Badge & Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className={`p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors relative ${
                    notificationsOpen ? "bg-clay-highlight text-white" : ""
                  }`}
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {pendingInvites.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-black text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {pendingInvites.length}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 clay-card-elevated p-3 shadow-2xl border border-white/10 z-50 space-y-2">
                    <div className="flex items-center justify-between pb-2 border-t border-b border-white/5">
                      <span className="text-xs font-semibold text-white">Notifications</span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {pendingInvites.length} pending
                      </span>
                    </div>

                    {pendingInvites.length === 0 ? (
                      <div className="py-6 text-center text-xs text-zinc-500">
                        No pending invitations
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {pendingInvites.map((inv) => (
                          <div
                            key={inv.id}
                            className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-2"
                          >
                            <div className="text-xs text-zinc-300">
                              <strong className="text-brand-400">@{inv.invitedBy}</strong> invited you to join{" "}
                              <span className="text-white font-medium">{inv.room.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleInviteAction(inv.id, "ACCEPT")}
                                className="flex-1 py-1 px-2.5 clay-btn-primary text-[11px] flex items-center justify-center gap-1"
                              >
                                <DoorOpen className="w-3 h-3" />
                                Join Room
                              </button>
                              <button
                                type="button"
                                onClick={() => handleInviteAction(inv.id, "DECLINE")}
                                className="py-1 px-2.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-[11px]"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="clay-pill px-3 py-1 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-clay-elevated flex items-center justify-center text-[10px] font-semibold text-zinc-200">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-zinc-300">
                  @{user.username}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>

              <button
                onClick={() => logout()}
                title="Sign out"
                className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-clay-highlight/50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="clay-btn-primary px-3.5 py-1.5 text-xs"
              >
                Join Now
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu toggle */}
        <div className="flex md:hidden items-center gap-2">
          {user && (
            <Link
              href="/rooms/create"
              className="clay-btn-primary p-2"
            >
              <Plus className="w-3.5 h-3.5" />
            </Link>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-zinc-400 hover:text-zinc-200 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 max-w-6xl mx-auto clay-card-elevated p-4 space-y-2">
          <Link
            href="/rooms"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:text-white rounded-xl hover:bg-clay-highlight"
          >
            <Compass className="w-4 h-4 text-zinc-400" />
            Explore Rooms
          </Link>

          {user && (
            <Link
              href="/messages"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:text-white rounded-xl hover:bg-clay-highlight"
            >
              <MessageSquare className="w-4 h-4 text-zinc-400" />
              Direct Messages
            </Link>
          )}

          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs text-amber-400 hover:text-amber-300 rounded-xl hover:bg-clay-highlight"
            >
              <Shield className="w-4 h-4 text-amber-500" />
              Admin Console
            </Link>
          )}

          {user ? (
            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-zinc-300 font-medium">@{user.username}</span>
              <button
                onClick={() => logout()}
                className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="clay-btn-secondary text-center py-2 text-xs font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="clay-btn-primary text-center py-2 text-xs font-semibold"
              >
                Join Now
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
