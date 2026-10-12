"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Shield,
  Users,
  Radio,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Trash2,
  Lock,
  Globe,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";

interface Metrics {
  totalUsers: number;
  verifiedUsers: number;
  totalRooms: number;
  publicRooms: number;
  totalMessages: number;
  roomMessages: number;
  directMessages: number;
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  status: string;
  createdAt: string;
  _count: {
    hostedRooms: number;
    participations: number;
    roomMessages: number;
  };
}

interface AdminRoom {
  id: string;
  code: string;
  name: string;
  isPublic: boolean;
  createdAt: string;
  host: {
    id: string;
    username: string;
    email: string;
  };
  _count: {
    participants: number;
    messages: number;
  };
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"USERS" | "ROOMS">("USERS");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [resMetrics, resUsers, resRooms] = await Promise.all([
        fetch("/api/admin/metrics"),
        fetch("/api/admin/users"),
        fetch("/api/admin/rooms"),
      ]);

      if (resMetrics.ok) {
        const m = await resMetrics.json();
        setMetrics(m.metrics);
      }

      if (resUsers.ok) {
        const u = await resUsers.json();
        setUsers(u.users || []);
      }

      if (resRooms.ok) {
        const r = await resRooms.json();
        setRooms(r.rooms || []);
      }
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "ADMIN") {
      loadData();
    }
  }, [user]);

  const handleToggleVerification = async (targetUser: AdminUser) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUser.id,
          isEmailVerified: !targetUser.isEmailVerified,
        }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === targetUser.id ? { ...u, isEmailVerified: !u.isEmailVerified } : u
          )
        );
      }
    } catch (err) {
      console.error("Verification update error:", err);
    }
  };

  const handleToggleRole = async (targetUser: AdminUser) => {
    const nextRole = targetUser.role === "ADMIN" ? "USER" : "ADMIN";
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUser.id,
          role: nextRole,
        }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, role: nextRole } : u))
        );
      }
    } catch (err) {
      console.error("Role update error:", err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to permanently delete this user account?")) return;
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch (err) {
      console.error("Delete user error:", err);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm("Are you sure you want to terminate this room?")) return;
    try {
      const res = await fetch(`/api/admin/rooms?id=${roomId}`, { method: "DELETE" });
      if (res.ok) {
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
      }
    } catch (err) {
      console.error("Delete room error:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-xs text-zinc-500 animate-pulse font-medium">
        Verifying administrator session...
      </div>
    );
  }

  if (user?.role !== "ADMIN") {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="max-w-md p-8 clay-card-elevated space-y-4">
          <Shield className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Access Denied</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            This console is reserved exclusively for platform administrators.
          </p>
          <Link
            href="/"
            className="clay-btn-secondary inline-block px-4 py-2 text-xs"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRooms = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.host.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-400 mb-1">
            <Shield className="w-3.5 h-3.5" />
            Administration
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            System Console
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Audit registered accounts, emails, verified status, and rooms.
          </p>
        </div>

        <button
          onClick={loadData}
          className="clay-btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Metrics Row */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="clay-card p-4 space-y-1">
            <span className="text-[11px] text-zinc-400 font-medium">
              Total Accounts
            </span>
            <p className="text-2xl font-bold text-white">{metrics.totalUsers}</p>
            <p className="text-[11px] text-emerald-400 font-medium">
              {metrics.verifiedUsers} Verified
            </p>
          </div>

          <div className="clay-card p-4 space-y-1">
            <span className="text-[11px] text-zinc-400 font-medium">
              Active Rooms
            </span>
            <p className="text-2xl font-bold text-white">{metrics.totalRooms}</p>
            <p className="text-[11px] text-amber-400 font-medium">
              {metrics.publicRooms} Public
            </p>
          </div>

          <div className="clay-card p-4 space-y-1">
            <span className="text-[11px] text-zinc-400 font-medium">
              In-Room Chats
            </span>
            <p className="text-2xl font-bold text-white">{metrics.roomMessages}</p>
            <p className="text-[11px] text-zinc-400">Total Live Messages</p>
          </div>

          <div className="clay-card p-4 space-y-1">
            <span className="text-[11px] text-zinc-400 font-medium">
              Direct Messages
            </span>
            <p className="text-2xl font-bold text-white">{metrics.directMessages}</p>
            <p className="text-[11px] text-zinc-400">1-on-1 Messages</p>
          </div>
        </div>
      )}

      {/* Tabs and Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="clay-pill p-1 flex items-center gap-1 w-fit">
          <button
            onClick={() => setActiveTab("USERS")}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeTab === "USERS" ? "bg-clay-elevated text-white shadow-inner font-semibold" : "text-zinc-400"
            }`}
          >
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("ROOMS")}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeTab === "ROOMS" ? "bg-clay-elevated text-white shadow-inner font-semibold" : "text-zinc-400"
            }`}
          >
            Rooms ({rooms.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab.toLowerCase()}...`}
            className="w-full pl-8 pr-3 py-1.5 text-xs clay-input"
          />
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Users Management Table */}
      {activeTab === "USERS" && (
        <div className="clay-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-clay-sunken text-zinc-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-clay-elevated flex items-center justify-center text-[10px] text-zinc-200 font-bold">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white font-medium">@{u.username}</span>
                    </td>
                    <td className="p-3.5 text-zinc-300 select-all">{u.email}</td>
                    <td className="p-3.5">
                      {u.isEmailVerified ? (
                        <span className="clay-pill px-2 py-0.5 text-[10px] text-emerald-400 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="clay-pill px-2 py-0.5 text-[10px] text-amber-400 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Pending OTP
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`clay-pill px-2 py-0.5 text-[10px] uppercase font-bold ${
                          u.role === "ADMIN"
                            ? "text-amber-400"
                            : "text-zinc-400"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleToggleVerification(u)}
                        className="clay-pill px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white"
                      >
                        {u.isEmailVerified ? "Mark Unverified" : "Force Verify"}
                      </button>

                      {u.id !== user.id && (
                        <>
                          <button
                            onClick={() => handleToggleRole(u)}
                            className="clay-pill px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white"
                          >
                            {u.role === "ADMIN" ? "Demote" : "Make Admin"}
                          </button>

                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-red-400 inline-block align-middle"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rooms Audit Table */}
      {activeTab === "ROOMS" && (
        <div className="clay-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-clay-sunken text-zinc-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Title</th>
                  <th className="p-3.5">Host</th>
                  <th className="p-3.5">Visibility</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRooms.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 text-brand-400 font-semibold">{r.code}</td>
                    <td className="p-3.5 text-white font-medium">{r.name}</td>
                    <td className="p-3.5 text-zinc-300">
                      @{r.host.username}
                    </td>
                    <td className="p-3.5">
                      <span className="clay-pill px-2 py-0.5 text-[10px] text-zinc-400 inline-flex items-center gap-1">
                        {r.isPublic ? (
                          <>
                            <Globe className="w-3 h-3 text-zinc-400" />
                            Public
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-amber-500" />
                            Closed
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <Link
                        href={`/room/${r.code}`}
                        className="clay-pill px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white inline-block"
                      >
                        Inspect
                      </Link>
                      <button
                        onClick={() => handleDeleteRoom(r.id)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-red-400 inline-block align-middle"
                        title="Terminate Room"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
