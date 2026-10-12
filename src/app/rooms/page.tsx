"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Compass,
  Plus,
  Search,
  Play,
  Lock,
  Globe,
  ArrowRight,
  Radio,
  Copy,
  Check,
} from "lucide-react";

interface Room {
  id: string;
  code: string;
  name: string;
  description: string;
  isPublic: boolean;
  participantCount: number;
  currentMediaTitle: string | null;
  mediaState: string;
  host: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
}

export default function RoomsExplorePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [directCode, setDirectCode] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchRooms = async (query = "") => {
    try {
      const res = await fetch(`/api/rooms?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRooms(search);
  };

  const handleJoinDirect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directCode.trim()) return;
    const clean = directCode.trim().toLowerCase().replace("lomely.app/room/", "");
    router.push(`/room/${clean}`);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Banner & Room Direct Connect */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-brand-400 mb-1">
            <Compass className="w-3.5 h-3.5" />
            Discover
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Rooms
          </h1>
          <p className="text-xs text-zinc-400 max-w-md">
            Join a public room or enter a direct room code to connect with friends.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Direct Code Join Input */}
          <form onSubmit={handleJoinDirect} className="flex items-center gap-2">
            <input
              type="text"
              value={directCode}
              onChange={(e) => setDirectCode(e.target.value)}
              placeholder="Enter room code..."
              className="clay-input px-3.5 py-2 text-xs w-44 sm:w-52"
            />
            <button
              type="submit"
              className="clay-btn-secondary px-3.5 py-2 text-xs font-medium"
            >
              Join
            </button>
          </form>

          {user && (
            <Link
              href="/rooms/create"
              className="clay-btn-primary px-4 py-2 text-xs flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Room
            </Link>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative max-w-md">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            fetchRooms(e.target.value);
          }}
          placeholder="Search rooms..."
          className="clay-input w-full pl-9 pr-4 py-2 text-xs"
        />
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
      </form>

      {/* Room Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-zinc-500 animate-pulse font-medium">
          Loading rooms...
        </div>
      ) : rooms.length === 0 ? (
        <div className="clay-card p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl clay-pill flex items-center justify-center mx-auto text-zinc-400">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No active rooms found</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Be the first to launch a room and invite your friends.
            </p>
          </div>
          {user ? (
            <Link
              href="/rooms/create"
              className="clay-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Start a Room
            </Link>
          ) : (
            <Link
              href="/signup"
              className="clay-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs"
            >
              Create Account to Start
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="clay-card p-5 flex flex-col justify-between hover:translate-y-[-2px] transition-all space-y-4"
            >
              <div className="space-y-3">
                {/* Header: Code + Visibility */}
                <div className="flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleCopyCode(room.code)}
                    title="Copy code"
                    className="clay-pill px-2.5 py-1 text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <span>{room.code}</span>
                    {copiedCode === room.code ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 opacity-60" />
                    )}
                  </button>

                  <span className="clay-pill px-2.5 py-1 text-[11px] text-zinc-400 flex items-center gap-1">
                    {room.isPublic ? (
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
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-base font-bold text-white line-clamp-1">
                    {room.name}
                  </h3>
                  <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                    {room.description || "Shared media and voice room."}
                  </p>
                </div>

                {/* Now Playing Banner */}
                <div className="clay-card p-2.5 flex items-center gap-2.5 text-xs">
                  <div className="w-6 h-6 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0">
                    <Play className="w-3 h-3 fill-current" />
                  </div>
                  <p className="text-xs text-zinc-300 truncate">
                    {room.currentMediaTitle || "Idle // No media playing"}
                  </p>
                </div>
              </div>

              {/* Footer: Host & Action */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <div className="w-6 h-6 rounded-full bg-clay-elevated flex items-center justify-center text-[10px] text-zinc-200 font-semibold">
                    {room.host.username.charAt(0).toUpperCase()}
                  </div>
                  <span>@{room.host.username}</span>
                </div>

                <Link
                  href={`/room/${room.code}`}
                  className="clay-btn-primary px-3 py-1.5 text-xs flex items-center gap-1"
                >
                  Join
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
