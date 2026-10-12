"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Play,
  Volume2,
  Video,
  MonitorUp,
  MessageSquare,
  Lock,
  Globe,
  ArrowRight,
  Mic,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="relative overflow-hidden flex flex-col items-center">
      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 clay-pill text-xs text-zinc-300 font-medium"
        >
          <span className="w-2 h-2 rounded-full bg-brand-500 shadow-glow" />
          Synchronized Media & Spatial Spaces
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.1]"
        >
          Watch and listen together, <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-zinc-400">
            perfectly in sync.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-base sm:text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed"
        >
          Create rooms to stream YouTube videos with friends, jump into voice and video calls,
          share your screen, and chat without third-party tracking.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3"
        >
          <Link
            href={user ? "/rooms/create" : "/signup"}
            className="w-full sm:w-auto clay-btn-primary px-7 py-3.5 text-sm flex items-center justify-center gap-2"
          >
            Create a Room
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/rooms"
            className="w-full sm:w-auto clay-btn-secondary px-7 py-3.5 text-sm flex items-center justify-center gap-2"
          >
            Explore Rooms
          </Link>
        </motion.div>

        {/* Claymorphic Product Stage Preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-14 max-w-4xl mx-auto"
        >
          <div className="clay-card-elevated p-5 sm:p-7 space-y-5">
            {/* Stage Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-glow" />
                <span className="text-xs font-medium text-zinc-300">
                  Synthwave Lounge
                </span>
                <span className="clay-pill px-2 py-0.5 text-[11px] text-zinc-400">
                  lml-cyber
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="clay-pill px-2.5 py-1 text-[11px] text-emerald-400 font-medium">
                  Synced (0.01s)
                </span>
              </div>
            </div>

            {/* Media Player Showcase */}
            <div className="relative aspect-video rounded-2xl bg-clay-sunken overflow-hidden flex flex-col justify-between p-4 shadow-inner">
              {/* Center Ambient Graphic */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-24 h-24 rounded-full bg-brand-500/10 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full clay-btn-primary flex items-center justify-center text-black">
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Top media status badge */}
              <div className="relative z-10 flex items-center justify-between">
                <span className="clay-pill px-3 py-1 text-xs text-zinc-200">
                  Lofi & Chill Beats &bull; Live Stream
                </span>
                <span className="clay-pill px-2.5 py-1 text-xs text-zinc-400">
                  1080p 60fps
                </span>
              </div>

              {/* Bottom Player Controls */}
              <div className="relative z-10 space-y-2">
                <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="w-2/5 h-full bg-brand-500 rounded-full" />
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>14:20 / 48:00</span>
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-zinc-400" />
                    <span>80%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Tactile Participants Pill Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <div className="clay-card px-3 py-1.5 flex items-center gap-2 text-xs">
                  <div className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 font-bold flex items-center justify-center text-[10px]">
                    A
                  </div>
                  <span className="text-zinc-200 font-medium">@alex</span>
                  <Mic className="w-3 h-3 text-brand-400" />
                </div>

                <div className="clay-card px-3 py-1.5 flex items-center gap-2 text-xs">
                  <div className="w-5 h-5 rounded-full bg-clay-highlight text-zinc-300 font-bold flex items-center justify-center text-[10px]">
                    S
                  </div>
                  <span className="text-zinc-300">@sophia</span>
                </div>

                <div className="clay-card px-3 py-1.5 flex items-center gap-2 text-xs">
                  <div className="w-5 h-5 rounded-full bg-clay-highlight text-zinc-300 font-bold flex items-center justify-center text-[10px]">
                    K
                  </div>
                  <span className="text-zinc-300">@kai</span>
                </div>
              </div>

              <div className="clay-pill px-3 py-1 text-xs text-zinc-400 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                In-Room Chat Ready
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Clean Feature Pillars (Uncluttered) */}
      <section className="w-full py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="clay-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl clay-pill flex items-center justify-center text-brand-400">
              <Play className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Synchronized Media</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Paste any YouTube link. Room participants stay locked to the exact same millisecond
              with automated drift correction.
            </p>
          </div>

          {/* Card 2 */}
          <div className="clay-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl clay-pill flex items-center justify-center text-amber-400">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Voice & Screen Sharing</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Hop into low-latency WebRTC calls. Toggle mic, webcam, and broadcast your screen
              directly inside the room.
            </p>
          </div>

          {/* Card 3 */}
          <div className="clay-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl clay-pill flex items-center justify-center text-zinc-300">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Private & Public Rooms</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Host closed rooms accessible only to invited usernames, or public spaces
              discoverable in the community directory.
            </p>
          </div>
        </div>
      </section>

      {/* Clean Footer */}
      <footer className="w-full py-8 border-t border-white/5 text-center text-xs text-zinc-500 font-sans">
        Lomely &bull; Synchronized Spaces &bull; 2026
      </footer>
    </div>
  );
}
