"use client";

import React, { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Music,
  Radio,
  Coffee,
  Check,
  X,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { extractYouTubeId, formatTime } from "@/lib/youtube";

// Extend window for YouTube iframe API
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface PauseRequestAlert {
  reason: string;
  user: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
  timestamp: number;
}

interface SyncPlayerProps {
  roomCode: string;
  isHost: boolean;
  isPublicRoom?: boolean;
  socket: Socket | null;
  initialMediaUrl?: string | null;
  initialMediaTitle?: string | null;
  initialArtist?: string | null;
  initialArtworkUrl?: string | null;
  initialMediaType?: "AUDIUS" | "YOUTUBE" | null;
  currentUser?: { id: string; username: string } | null;
  onOpenMediaHub?: () => void;
}

const QUICK_PAUSE_REASONS = [
  "Toilet / BRB",
  "Need a minute",
  "Grab a drink",
  "Answering door",
  "Phone call",
];

// In-memory cache for audio streams buffered into Blobs
const blobUrlCache = new Map<string, string>();

export default function SyncPlayer({
  roomCode,
  isHost,
  isPublicRoom = false,
  socket,
  initialMediaUrl,
  initialMediaTitle,
  initialArtist,
  initialArtworkUrl,
  initialMediaType,
  currentUser,
  onOpenMediaHub,
}: SyncPlayerProps) {
  // Media references
  const playerRef = useRef<any>(null); // YouTube player ref
  const audioRef = useRef<HTMLAudioElement | null>(null); // Audius HTML5 audio ref
  const isSeekingRef = useRef(false);

  // Audio Stream Buffer States
  const [isBufferingAudio, setIsBufferingAudio] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [bufferedBytes, setBufferedBytes] = useState<{ loaded: number; total: number } | null>(null);
  const shouldPlayWhenReadyRef = useRef(false);
  const pendingSeekTimeRef = useRef<number | null>(null);

  // Media state
  const [currentUrl, setCurrentUrl] = useState(initialMediaUrl || "");
  const [mediaTitle, setMediaTitle] = useState(initialMediaTitle || "");
  const [artist, setArtist] = useState(initialArtist || "");
  const [artworkUrl, setArtworkUrl] = useState(initialArtworkUrl || "");
  const [mediaType, setMediaType] = useState<"AUDIUS" | "YOUTUBE">(
    initialMediaType || (initialMediaUrl?.includes("audius") ? "AUDIUS" : "YOUTUBE")
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  currentTimeRef.current = currentTime;
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);

  // Master server timeline state (for public room "YouTube Live" sync)
  const masterStateRef = useRef<{
    state: "PLAYING" | "PAUSED";
    currentTime: number;
    updatedAt: number;
  }>({
    state: "PLAYING",
    currentTime: 0,
    updatedAt: Date.now(),
  });
  const [liveLagSeconds, setLiveLagSeconds] = useState(0);

  // Pause Request Modal & Host Alert state (for private room friend circle)
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [customReason, setCustomReason] = useState("");
  const [pauseAlert, setPauseAlert] = useState<PauseRequestAlert | null>(null);
  const [hasRequestedPause, setHasRequestedPause] = useState(false);

  const videoId = mediaType === "YOUTUBE" ? extractYouTubeId(currentUrl) : null;

  // 1. YouTube IFrame API Initialization
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  useEffect(() => {
    if (mediaType !== "YOUTUBE" || !videoId) return;

    let destroyed = false;

    const initPlayer = () => {
      if (destroyed || !window.YT || !window.YT.Player) return;

      if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
        try {
          playerRef.current.loadVideoById(videoId);
          return;
        } catch {}
      }

      playerRef.current = new window.YT.Player(`yt-player-container-${roomCode}`, {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          enablejsapi: 1,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
        events: {
          onReady: (event: any) => {
            setDuration(event.target.getDuration() || 0);
            event.target.setVolume(volume);
            if (isPlaying) {
              event.target.playVideo();
            }
          },
          onStateChange: (event: any) => {
            if (event.data === 1) setIsPlaying(true);
            if (event.data === 2) setIsPlaying(false);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      destroyed = true;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
      }
    };
  }, [mediaType, videoId, roomCode]);

  // 2. Audius Stream Buffering & HTML5 Audio Management
  useEffect(() => {
    if (mediaType !== "AUDIUS" || !currentUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.volume = volume / 100;
    audio.muted = isMuted;

    let isCancelled = false;
    const abortController = new AbortController();

    const onLoadedMetadata = () => {
      if (!isCancelled && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      if (pendingSeekTimeRef.current !== null) {
        audio.currentTime = pendingSeekTimeRef.current;
        pendingSeekTimeRef.current = null;
      }
      if (shouldPlayWhenReadyRef.current || isPlaying) {
        audio.play().catch(() => {});
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      if (!isSeekingRef.current) {
        setCurrentTime(audio.currentTime);
      }
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);

    // Stream Buffer Caching:
    // If the stream is already stored in memory buffer (Blob URL), play instantly!
    const cachedBlobUrl = blobUrlCache.get(currentUrl);
    if (cachedBlobUrl) {
      setIsBufferingAudio(false);
      setBufferProgress(100);
      if (audio.src !== cachedBlobUrl) {
        audio.src = cachedBlobUrl;
        audio.load();
      }
    } else {
      // Buffer the stream from network into memory before playing to guarantee zero crackling
      setIsBufferingAudio(true);
      setBufferProgress(0);
      setBufferedBytes(null);

      // Route external Audius URLs through our high-speed local proxy with Range support
      let targetUrl = currentUrl;
      if (targetUrl.includes("audius.co/v1/tracks") && !targetUrl.includes("/api/music/audius/stream")) {
        const trackIdMatch = targetUrl.match(/tracks\/([^/?]+)/);
        if (trackIdMatch && trackIdMatch[1]) {
          targetUrl = `/api/music/audius/stream?id=${trackIdMatch[1]}`;
        }
      }

      const loadBuffer = async () => {
        try {
          const res = await fetch(targetUrl, { signal: abortController.signal });
          if (!res.ok) throw new Error(`Audio buffer fetch error: ${res.status}`);

          const contentLengthHeader = res.headers.get("content-length");
          const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

          if (res.body) {
            const reader = res.body.getReader();
            const chunks: Uint8Array[] = [];
            let loadedBytes = 0;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                chunks.push(value);
                loadedBytes += value.length;
                if (!isCancelled) {
                  if (totalBytes > 0) {
                    const pct = Math.min(99, Math.round((loadedBytes / totalBytes) * 100));
                    setBufferProgress(pct);
                  }
                  setBufferedBytes({ loaded: loadedBytes, total: totalBytes });
                }
              }
            }

            if (isCancelled) return;

            const audioBlob = new Blob(chunks as any[], { type: "audio/mpeg" });
            const blobUrl = URL.createObjectURL(audioBlob);
            blobUrlCache.set(currentUrl, blobUrl);

            audio.src = blobUrl;
            audio.load();
            setBufferProgress(100);
            setIsBufferingAudio(false);
          } else {
            const audioBlob = await res.blob();
            if (isCancelled) return;
            const blobUrl = URL.createObjectURL(audioBlob);
            blobUrlCache.set(currentUrl, blobUrl);

            audio.src = blobUrl;
            audio.load();
            setBufferProgress(100);
            setIsBufferingAudio(false);
          }
        } catch (err: any) {
          if (err.name === "AbortError" || isCancelled) return;
          console.warn("[Audio Buffer] Fallback to direct stream:", err);
          if (!isCancelled) {
            audio.src = targetUrl;
            audio.load();
            setIsBufferingAudio(false);
          }
        }
      };

      loadBuffer();
    }

    return () => {
      isCancelled = true;
      abortController.abort();
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [mediaType, currentUrl]);

  // 3. YouTube Time Polling
  useEffect(() => {
    if (mediaType !== "YOUTUBE" || !videoId) return;

    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
        if (!isSeekingRef.current) {
          const t = playerRef.current.getCurrentTime();
          setCurrentTime(t);
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [mediaType, videoId]);

  // 4. Master Live Timeline Drift Tracker (Computes lag in public rooms)
  useEffect(() => {
    const interval = setInterval(() => {
      const master = masterStateRef.current;
      const liveTime =
        master.state === "PLAYING"
          ? master.currentTime + (Date.now() - master.updatedAt) / 1000
          : master.currentTime;

      const lag = liveTime - currentTimeRef.current;
      setLiveLagSeconds(Math.max(0, lag));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 5. Socket Synchronization Listeners
  useEffect(() => {
    if (!socket) return;

    // Full media state sync from server
    const handleSyncState = (state: any) => {
      masterStateRef.current = {
        state: state.state || "PLAYING",
        currentTime: state.currentTime || 0,
        updatedAt: state.updatedAt || Date.now(),
      };

      if (state.url && state.url !== currentUrl) {
        setCurrentUrl(state.url);
        setMediaTitle(state.title || "Streaming Track");
        setArtist(state.artist || "");
        setArtworkUrl(state.artworkUrl || "");
        setMediaType(state.mediaType || (state.url.includes("audius") ? "AUDIUS" : "YOUTUBE"));
      }

      // Compute exact current timestamp with drift compensation
      const liveTime =
        state.state === "PLAYING"
          ? state.currentTime + (Date.now() - state.updatedAt) / 1000
          : state.currentTime;

      // In public room: non-hosts don't get forced to seek if they paused locally
      // In private room (or for host): sync automatically
      if (!isPublicRoom || isHost) {
        seekMediaTo(liveTime);
        if (state.state === "PLAYING") {
          playMediaLocal();
        } else {
          pauseMediaLocal();
        }
      }
    };

    // Global Play
    const handleSyncPlay = ({ currentTime: targetTime, updatedAt }: any) => {
      masterStateRef.current = {
        state: "PLAYING",
        currentTime: targetTime,
        updatedAt: updatedAt || Date.now(),
      };

      if (!isPublicRoom || isHost) {
        const liveTime = Number(targetTime) + (Date.now() - (updatedAt || Date.now())) / 1000;
        seekMediaTo(liveTime);
        playMediaLocal();
      }
    };

    // Global Pause
    const handleSyncPause = ({ currentTime: targetTime }: any) => {
      masterStateRef.current = {
        state: "PAUSED",
        currentTime: targetTime,
        updatedAt: Date.now(),
      };

      if (!isPublicRoom || isHost) {
        seekMediaTo(Number(targetTime));
        pauseMediaLocal();
      }
    };

    // Global Seek
    const handleSyncSeek = ({ seekTime }: any) => {
      masterStateRef.current.currentTime = seekTime;
      masterStateRef.current.updatedAt = Date.now();

      if (!isPublicRoom || isHost) {
        seekMediaTo(Number(seekTime), true);
      }
    };

    // Private Room: Roommate Pause Request Alert (Displayed to host)
    const handlePauseAlert = (alertData: PauseRequestAlert) => {
      if (isHost) {
        setPauseAlert(alertData);
      }
    };

    socket.on("media:sync:state", handleSyncState);
    socket.on("media:sync:play", handleSyncPlay);
    socket.on("media:sync:pause", handleSyncPause);
    socket.on("media:sync:seek", handleSyncSeek);
    socket.on("media:request:pause:alert", handlePauseAlert);

    return () => {
      socket.off("media:sync:state", handleSyncState);
      socket.off("media:sync:play", handleSyncPlay);
      socket.off("media:sync:pause", handleSyncPause);
      socket.off("media:sync:seek", handleSyncSeek);
      socket.off("media:request:pause:alert", handlePauseAlert);
    };
  }, [socket, roomCode, isHost, isPublicRoom]);

  // Helper playback functions
  const playMediaLocal = () => {
    setIsPlaying(true);
    if (mediaType === "AUDIUS") {
      shouldPlayWhenReadyRef.current = true;
      if (audioRef.current && !isBufferingAudio) {
        audioRef.current.play().catch(() => {});
      }
    } else if (mediaType === "YOUTUBE" && playerRef.current) {
      playerRef.current.playVideo?.();
    }
  };

  const pauseMediaLocal = () => {
    setIsPlaying(false);
    if (mediaType === "AUDIUS") {
      shouldPlayWhenReadyRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else if (mediaType === "YOUTUBE" && playerRef.current) {
      playerRef.current.pauseVideo?.();
    }
  };

  const seekMediaTo = (time: number, force = false) => {
    const safeTime = Math.max(0, time);
    setCurrentTime(safeTime);
    if (mediaType === "AUDIUS") {
      if (isBufferingAudio) {
        pendingSeekTimeRef.current = safeTime;
      } else if (audioRef.current) {
        const cur = audioRef.current.currentTime || 0;
        if (force || Math.abs(cur - safeTime) > 1.5) {
          audioRef.current.currentTime = safeTime;
        }
      }
    } else if (mediaType === "YOUTUBE" && playerRef.current) {
      try {
        const cur =
          typeof playerRef.current.getCurrentTime === "function"
            ? playerRef.current.getCurrentTime()
            : 0;
        // CRITICAL: Only seek YouTube if forced or if drift exceeds 1.5 seconds.
        // Micro-seeking every few frames triggers YouTube's buffering pipeline, freezing video.
        if (force || Math.abs(cur - safeTime) > 1.5) {
          playerRef.current.seekTo(safeTime, true);
        }
      } catch {}
    }
  };

  // Play/Pause Action
  const handleTogglePlayPause = () => {
    if (isPublicRoom && !isHost) {
      // In Public Room for non-host: Play/Pause ONLY controls local client
      if (isPlaying) {
        pauseMediaLocal();
      } else {
        playMediaLocal();
      }
      return;
    }

    // In Private Room (or Host in Public Room): Global Sync
    if (isPlaying) {
      pauseMediaLocal();
      socket?.emit("media:sync:pause", { roomCode, currentTime });
    } else {
      playMediaLocal();
      socket?.emit("media:sync:play", { roomCode, currentTime });
    }
  };

  // Public Room: Jump straight to Live Master Timeline (like YouTube Live)
  const handleSyncToLive = () => {
    const master = masterStateRef.current;
    const liveTime =
      master.state === "PLAYING"
        ? master.currentTime + (Date.now() - master.updatedAt) / 1000
        : master.currentTime;

    seekMediaTo(liveTime, true);
    playMediaLocal();
    setLiveLagSeconds(0);
  };

  // Seek Slider
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value);
    setCurrentTime(targetTime);

    if (isPublicRoom && !isHost) {
      seekMediaTo(targetTime, true);
    } else {
      seekMediaTo(targetTime, true);
      socket?.emit("media:sync:seek", { roomCode, seekTime: targetTime });
    }
  };

  // Volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);

    if (mediaType === "AUDIUS" && audioRef.current) {
      audioRef.current.volume = vol / 100;
      audioRef.current.muted = vol === 0;
    } else if (mediaType === "YOUTUBE" && playerRef.current) {
      playerRef.current.setVolume?.(vol);
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (mediaType === "AUDIUS" && audioRef.current) {
      audioRef.current.muted = nextMuted;
    } else if (mediaType === "YOUTUBE" && playerRef.current) {
      if (nextMuted) playerRef.current.mute?.();
      else playerRef.current.unMute?.();
    }
  };

  // Private Room: Roommate sends Pause Request
  const handleSubmitPauseRequest = (reason: string) => {
    if (!socket || !currentUser) return;
    socket.emit("media:request:pause", {
      roomCode,
      reason,
      user: currentUser,
    });
    setHasRequestedPause(true);
    setRequestModalOpen(false);
  };

  // Private Room: Roommate sends Resume Request ("I'm back")
  const handleSendResumeRequest = () => {
    if (!socket || !currentUser) return;
    socket.emit("media:request:resume", {
      roomCode,
      user: currentUser,
    });
    setHasRequestedPause(false);
  };

  // Host approves Pause Request
  const handleHostApprovePause = () => {
    pauseMediaLocal();
    socket?.emit("media:sync:pause", { roomCode, currentTime });
    setPauseAlert(null);
  };

  return (
    <div className="flex flex-col gap-2 w-full h-full justify-center max-w-full relative">
      {/* Host Toast Alert for Roommate Pause Request (Private Room) */}
      {pauseAlert && isHost && (
        <div className="absolute top-3 left-3 right-3 z-30 clay-card-elevated p-3 rounded-2xl flex items-center justify-between border border-brand-500/30 bg-[#0f111c]/95 shadow-2xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0">
              <Coffee className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                @{pauseAlert.user.username} requested a pause
              </p>
              <p className="text-[11px] text-zinc-400 truncate">
                Reason: "{pauseAlert.reason}"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleHostApprovePause}
              className="clay-btn-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause for Everyone</span>
            </button>
            <button
              type="button"
              onClick={() => setPauseAlert(null)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Player Display Box */}
      <div className="relative aspect-video max-h-[calc(100vh-160px)] w-full rounded-3xl bg-[#090a10] overflow-hidden group shadow-clay-card flex items-center justify-center border border-white/5">
        {/* CASE A: AUDIUS MUSIC PLAYER (High-end Claymorphic Vinyl & Visualizer Stage) */}
        {mediaType === "AUDIUS" && currentUrl ? (
          <div className="w-full h-full flex flex-col items-center justify-center relative p-6 bg-gradient-to-br from-[#0c0d16] via-[#08090f] to-[#05060a]">
            {/* Ambient Artwork Glow */}
            {artworkUrl && (
              <div
                className="absolute inset-0 opacity-20 filter blur-3xl scale-110 pointer-events-none"
                style={{
                  backgroundImage: `url(${artworkUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            )}

            {/* Center Album Art with Pulse & Visualizer */}
            <div className="relative z-10 flex flex-col items-center gap-4 text-center max-w-sm">
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-zinc-900 overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                {artworkUrl ? (
                  <img src={artworkUrl} alt={mediaTitle} className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-14 h-14 text-zinc-600" />
                )}

                {/* Vinyl Ring Overlay */}
                <div className="absolute inset-0 rounded-3xl border border-white/10 shadow-inner pointer-events-none" />
              </div>

              {/* Title & Artist */}
              <div className="space-y-1">
                <span className="clay-pill px-2.5 py-0.5 text-[10px] text-brand-400 font-mono inline-flex items-center gap-1">
                  <Radio className="w-3 h-3" />
                  Audius Stream
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate max-w-xs sm:max-w-sm">
                  {mediaTitle}
                </h3>
                {artist && <p className="text-xs text-zinc-400 font-medium">@{artist}</p>}
              </div>

              {/* Buffering Indicator vs Waveform Visualizer */}
              {isBufferingAudio ? (
                <div className="w-full max-w-xs space-y-2 pt-1 select-none">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="flex items-center gap-1.5 text-brand-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
                      Storing Audio Buffer...
                    </span>
                    <span className="text-zinc-300 font-bold">{bufferProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-150"
                      style={{ width: `${Math.max(6, bufferProgress)}%` }}
                    />
                  </div>
                  {bufferedBytes && (
                    <p className="text-[10px] text-zinc-500 font-mono text-center">
                      {(bufferedBytes.loaded / (1024 * 1024)).toFixed(1)} MB
                      {bufferedBytes.total > 0
                        ? ` / ${(bufferedBytes.total / (1024 * 1024)).toFixed(1)} MB buffered in memory`
                        : " buffered"}
                    </p>
                  )}
                </div>
              ) : isPlaying ? (
                /* Live Audio Equalizer Waveform Bars */
                <div className="flex items-end gap-1 h-5 pt-1">
                  <span className="w-1 bg-brand-400 rounded-full animate-pulse h-3" />
                  <span className="w-1 bg-brand-400 rounded-full animate-pulse delay-75 h-5" />
                  <span className="w-1 bg-brand-400 rounded-full animate-pulse delay-150 h-2" />
                  <span className="w-1 bg-brand-400 rounded-full animate-pulse delay-100 h-4" />
                  <span className="w-1 bg-brand-400 rounded-full animate-pulse delay-200 h-3" />
                </div>
              ) : null}
            </div>
          </div>
        ) : videoId ? (
          /* CASE B: YOUTUBE VIDEO PLAYER */
          <div className="w-full h-full">
            <div id={`yt-player-container-${roomCode}`} className="w-full h-full pointer-events-none" />
          </div>
        ) : (
          /* CASE C: EMPTY STATE (Open Media Hub CTA) */
          <div className="text-center p-8 space-y-4">
            <div className="w-14 h-14 rounded-2xl clay-pill flex items-center justify-center mx-auto text-brand-400">
              <Music className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">No stream playing yet</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                Play open music from Audius or stream any YouTube video with roommates.
              </p>
            </div>
            {onOpenMediaHub && (
              <button
                type="button"
                onClick={onOpenMediaHub}
                className="clay-btn-primary px-4 py-2 text-xs font-semibold"
              >
                Open Media Hub
              </button>
            )}
          </div>
        )}

        {/* Video & Music Controls Overlay */}
        {(currentUrl || videoId) && (
          <div className="absolute bottom-0 left-0 right-0 p-3.5 bg-gradient-to-t from-black/95 via-black/75 to-transparent z-20 flex flex-col gap-2">
            {/* Progress Slider (Hidden on 24/7 infinite live streams) */}
            {duration < 86400 && duration > 0 ? (
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-zinc-800 accent-brand-500 rounded-lg cursor-pointer"
              />
            ) : null}

            {/* Bottom Controls Bar */}
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <div className="flex items-center gap-2.5">
                {/* Play / Pause Button */}
                <button
                  type="button"
                  onClick={handleTogglePlayPause}
                  className="p-1 text-brand-400 hover:text-white transition-colors"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                </button>

                {/* Time Display or LIVE Badge */}
                {duration >= 86400 || duration === 0 ? (
                  <span className="clay-pill px-2 py-0.5 text-[10px] text-red-400 font-bold bg-red-950/80 border border-red-900/40 flex items-center gap-1.5 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-zinc-300 select-none">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                )}

                {/* PUBLIC ROOM: YouTube Live Sync Button */}
                {isPublicRoom && liveLagSeconds > 3 && (
                  <button
                    type="button"
                    onClick={handleSyncToLive}
                    className="clay-pill px-2.5 py-0.5 text-[10px] text-brand-400 bg-brand-950/80 border border-brand-500/40 font-semibold flex items-center gap-1 hover:text-white transition-colors"
                    title="Jump to current live broadcast"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Sync Live (+{Math.round(liveLagSeconds)}s)</span>
                  </button>
                )}

                {/* PRIVATE ROOM: Roommate "Ask to Pause" Button */}
                {!isPublicRoom && !isHost && (
                  <div className="flex items-center gap-1.5 ml-1">
                    {hasRequestedPause ? (
                      <button
                        type="button"
                        onClick={handleSendResumeRequest}
                        className="clay-pill px-2 py-0.5 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-900/40 font-semibold flex items-center gap-1 hover:text-white"
                      >
                        <Check className="w-3 h-3" />
                        <span>I'm Back (Ask to Play)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRequestModalOpen(true)}
                        className="clay-pill px-2 py-0.5 text-[10px] text-zinc-300 hover:text-white bg-black/60 border border-white/10 flex items-center gap-1"
                        title="Need a quick break? Ask host to pause"
                      >
                        <Coffee className="w-3 h-3 text-brand-400" />
                        <span>Ask to Pause</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Right Controls: Volume & Media Hub CTA */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="text-zinc-400 hover:text-white p-1"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-zinc-800 accent-brand-500 rounded-lg cursor-pointer"
                  />
                </div>

                {onOpenMediaHub && (
                  <button
                    type="button"
                    onClick={onOpenMediaHub}
                    className="clay-pill px-2.5 py-1 text-[11px] text-brand-400 hover:text-white font-medium flex items-center gap-1 transition-colors"
                  >
                    <Music className="w-3 h-3" />
                    <span>Media Hub</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Private Room: Roommate Ask to Pause Dialog */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="clay-card-elevated w-full max-w-sm p-5 rounded-3xl border border-white/10 shadow-2xl bg-[#0c0d15] space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Coffee className="w-4 h-4 text-brand-400" />
                Ask Host to Pause Room
              </h4>
              <button
                type="button"
                onClick={() => setRequestModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Pick a quick reason to let the host know you're stepping away:
            </p>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_PAUSE_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleSubmitPauseRequest(r)}
                  className="clay-pill px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:border-brand-500/50 transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customReason.trim()) handleSubmitPauseRequest(customReason.trim());
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Or custom note..."
                  className="flex-1 px-3 py-2 text-xs clay-input"
                />
                <button type="submit" className="clay-btn-primary px-3 py-2 text-xs font-semibold">
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
