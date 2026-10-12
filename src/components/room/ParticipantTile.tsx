"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  Volume2,
} from "lucide-react";

interface ParticipantTileProps {
  username: string;
  stream: MediaStream | null;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOn?: boolean;
  isScreenSharing?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  className?: string;
}

export default function ParticipantTile({
  username,
  stream,
  isLocal = false,
  isMuted = false,
  isVideoOn = false,
  isScreenSharing = false,
  isPinned = false,
  onTogglePin,
  className = "",
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [objectFitContain, setObjectFitContain] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // 1. Bind media stream to HTMLVideoElement and dedicated HTMLAudioElement reliably
  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;

    if (stream) {
      if (videoEl && videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
        videoEl.play().catch(() => {});
      }
      if (!isLocal && audioEl && audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
        audioEl.play().catch(() => {});
      }
    } else {
      if (videoEl) videoEl.srcObject = null;
      if (audioEl) audioEl.srcObject = null;
    }

    // Autoplay unlock upon any user interaction
    const unlockAutoplay = () => {
      if (!isLocal && audioEl && audioEl.paused) {
        audioEl.play().catch(() => {});
      }
      if (videoEl && videoEl.paused) {
        videoEl.play().catch(() => {});
      }
    };

    window.addEventListener("click", unlockAutoplay, { passive: true });
    window.addEventListener("touchstart", unlockAutoplay, { passive: true });
    window.addEventListener("keydown", unlockAutoplay, { passive: true });

    return () => {
      window.removeEventListener("click", unlockAutoplay);
      window.removeEventListener("touchstart", unlockAutoplay);
      window.removeEventListener("keydown", unlockAutoplay);
    };
  }, [stream, isLocal]);

  // 2. Throttled Active Speaker Detection via Web Audio API (Low CPU)
  useEffect(() => {
    if (isMuted || !stream) {
      setIsSpeaking(false);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      setIsSpeaking(false);
      return;
    }

    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let timer: NodeJS.Timeout | null = null;

    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const audioStream = new MediaStream([audioTracks[0]]);
      source = audioCtx.createMediaStreamSource(audioStream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      timer = setInterval(() => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const nowSpeaking = average > 14;
        setIsSpeaking((prev) => (prev !== nowSpeaking ? nowSpeaking : prev));
      }, 200);
    } catch {
      // AudioContext may be restricted before user gesture
    }

    return () => {
      if (timer) clearInterval(timer);
      if (source) source.disconnect();
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close().catch(() => {});
      }
    };
  }, [stream, isMuted]);

  // Check if video is truly displayable
  const hasLiveVideoTrack = Boolean(
    stream &&
      stream.getVideoTracks().some((track) => track.readyState === "live" && track.enabled)
  );
  const showVideo = isLocal
    ? Boolean((isVideoOn || isScreenSharing) && hasLiveVideoTrack)
    : Boolean(hasLiveVideoTrack || isVideoOn || isScreenSharing);
  const isScreen = isScreenSharing || Boolean(
    stream && stream.getVideoTracks().some((t) => t.label?.toLowerCase().includes("screen"))
  );

  return (
    <div
      className={`relative aspect-video rounded-2xl bg-[#090a0f] overflow-hidden clay-card flex items-center justify-center border transition-all duration-300 group ${
        isSpeaking
          ? "border-emerald-500/80 ring-2 ring-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
          : "border-white/5 hover:border-white/15 shadow-clay-card"
      } ${className}`}
    >
      {/* Remote Audio Track Direct Player (Ensures voice sounds even if video is hidden) */}
      {!isLocal && (
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          className="hidden"
        />
      )}

      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full transition-opacity duration-300 ${
          objectFitContain ? "object-contain" : "object-cover"
        } ${showVideo ? "opacity-100" : "opacity-0 pointer-events-none absolute"} ${
          isLocal && !isScreen ? "scale-x-[-1]" : ""
        }`}
      />

      {/* Avatar Display when Camera is Off */}
      {!showVideo && (
        <div className="flex flex-col items-center justify-center gap-2 select-none z-10">
          <div className="relative">
            {/* Concentric acoustic rings when user is actively speaking */}
            {isSpeaking && (
              <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
            )}
            <div
              className={`w-14 h-14 rounded-full bg-clay-elevated text-zinc-100 font-bold flex items-center justify-center text-lg shadow-inner border transition-colors ${
                isSpeaking ? "border-emerald-500/60 text-white" : "border-white/10"
              }`}
            >
              {username.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-300 font-medium">@{username}</span>
            <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
              <VideoOff className="w-2.5 h-2.5 text-zinc-600" />
            </span>
          </div>
        </div>
      )}

      {/* Top Hover Action Overlay (Pin & Aspect Ratio controls) */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        {showVideo && (
          <button
            type="button"
            onClick={() => setObjectFitContain(!objectFitContain)}
            className="p-1.5 rounded-lg bg-black/70 backdrop-blur-md text-zinc-300 hover:text-white border border-white/10 transition-colors"
            title={objectFitContain ? "Fill frame (Crop)" : "Fit to screen (Letterbox)"}
          >
            {objectFitContain ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {onTogglePin && (
          <button
            type="button"
            onClick={onTogglePin}
            className={`p-1.5 rounded-lg backdrop-blur-md border transition-colors ${
              isPinned
                ? "bg-brand-500 text-black border-brand-400"
                : "bg-black/70 text-zinc-300 hover:text-white border-white/10"
            }`}
            title={isPinned ? "Unpin participant" : "Pin participant to main stage"}
          >
            {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Bottom Name & Audio Wave Badges */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs z-10 pointer-events-none select-none gap-1.5">
        <div className="flex items-center min-w-0 flex-1">
          <span className="clay-pill px-2 py-0.5 text-[11px] text-zinc-200 font-medium truncate max-w-full bg-black/80 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
            {/* Live Audio Equalizer Bars */}
            {isSpeaking && (
              <span className="flex items-end gap-0.5 h-2.5 shrink-0" title="Speaking">
                <span className="w-0.5 h-2 bg-emerald-400 animate-pulse" />
                <span className="w-0.5 h-3 bg-emerald-400 animate-pulse delay-75" />
                <span className="w-0.5 h-1.5 bg-emerald-400 animate-pulse delay-150" />
              </span>
            )}
            <span className="truncate">
              @{username} {isLocal && "(You)"}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isMuted ? (
            <span className="clay-pill p-1 text-red-400 bg-red-950/80 backdrop-blur-md border border-red-900/40">
              <MicOff className="w-3 h-3" />
            </span>
          ) : isSpeaking ? (
            <span className="clay-pill p-1 text-emerald-400 bg-emerald-950/80 backdrop-blur-md border border-emerald-900/40">
              <Volume2 className="w-3 h-3" />
            </span>
          ) : null}

          {isScreen && (
            <span className="clay-pill px-1.5 py-0.5 text-[10px] text-cyan-300 font-medium bg-cyan-950/80 backdrop-blur-md border border-cyan-900/40 flex items-center gap-1">
              <MonitorUp className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Screen</span>
            </span>
          )}

          {showVideo && !isScreen && (
            <span className="clay-pill p-1 text-brand-400 bg-black/80 backdrop-blur-md border border-white/10">
              <Video className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
