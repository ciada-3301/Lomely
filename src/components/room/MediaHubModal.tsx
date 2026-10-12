"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  Music,
  Video,
  Play,
  Pause,
  Plus,
  Check,
  Radio,
  ListMusic,
  Trash2,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export interface AudiusTrack {
  id: string;
  title: string;
  artist: string;
  artistHandle?: string;
  duration: number;
  genre: string;
  mood?: string | null;
  artworkUrl?: string | null;
  streamUrl: string;
}

export interface SongSuggestion {
  id: string;
  track: {
    id: string;
    title: string;
    artist?: string;
    artworkUrl?: string | null;
    streamUrl?: string;
    url?: string;
    mediaType?: "AUDIUS" | "YOUTUBE";
    duration?: number;
  };
  suggestedBy: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
  suggestedAt: number;
}

interface MediaHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHost: boolean;
  isPublicRoom: boolean;
  currentMediaTitle?: string | null;
  queue: SongSuggestion[];
  onPlayMedia: (params: {
    url: string;
    title: string;
    artist?: string;
    artworkUrl?: string | null;
    mediaType: "AUDIUS" | "YOUTUBE";
    duration?: number;
  }) => void;
  onSuggestMedia: (track: {
    id: string;
    title: string;
    artist?: string;
    artworkUrl?: string | null;
    streamUrl?: string;
    url?: string;
    mediaType: "AUDIUS" | "YOUTUBE";
    duration?: number;
  }) => void;
  onDismissSuggestion: (suggestionId: string) => void;
}

const GENRE_PILLS = [
  { label: "All Trending", value: "" },
  { label: "Lo-Fi", value: "Lo-Fi" },
  { label: "Electronic", value: "Electronic" },
  { label: "Hip-Hop", value: "Hip-Hop/Rap" },
  { label: "Synthwave", value: "Synthwave" },
  { label: "Ambient", value: "Ambient" },
  { label: "Chillout", value: "Chillout" },
];

export default function MediaHubModal({
  isOpen,
  onClose,
  isHost,
  isPublicRoom,
  currentMediaTitle,
  queue,
  onPlayMedia,
  onSuggestMedia,
  onDismissSuggestion,
}: MediaHubModalProps) {
  const [activeTab, setActiveTab] = useState<"audius" | "youtube" | "queue">("audius");

  // Audius state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [tracks, setTracks] = useState<AudiusTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestedTrackIds, setSuggestedTrackIds] = useState<Set<string>>(new Set());

  // YouTube state
  const [ytUrl, setYtUrl] = useState("");

  // Local audio preview (5 seconds preview for finding songs)
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  // Fetch Audius tracks
  useEffect(() => {
    if (!isOpen || activeTab !== "audius") return;

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        let url = "/api/music/audius?";
        if (searchQuery.trim()) {
          url += `action=search&q=${encodeURIComponent(searchQuery.trim())}`;
        } else {
          url += `action=trending`;
          if (selectedGenre) {
            url += `&genre=${encodeURIComponent(selectedGenre)}`;
          }
        }

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setTracks(data.tracks || []);
          }
        }
      } catch (err) {
        console.error("Failed to load Audius tracks:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, searchQuery ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, activeTab, searchQuery, selectedGenre]);

  // Clean up audio preview when closing
  useEffect(() => {
    if (!isOpen && previewAudio) {
      previewAudio.pause();
      setPreviewAudio(null);
      setPreviewTrackId(null);
    }
  }, [isOpen, previewAudio]);

  const togglePreview = (track: AudiusTrack) => {
    if (previewTrackId === track.id) {
      previewAudio?.pause();
      setPreviewAudio(null);
      setPreviewTrackId(null);
    } else {
      previewAudio?.pause();
      const audio = new Audio(track.streamUrl);
      audio.volume = 0.5;
      audio.play().catch(() => {});
      setPreviewAudio(audio);
      setPreviewTrackId(track.id);
    }
  };

  const handlePlayAudius = (track: AudiusTrack) => {
    previewAudio?.pause();
    onPlayMedia({
      url: track.streamUrl,
      title: track.title,
      artist: track.artist,
      artworkUrl: track.artworkUrl,
      mediaType: "AUDIUS",
      duration: track.duration,
    });
    onClose();
  };

  const handleSuggestAudius = (track: AudiusTrack) => {
    onSuggestMedia({
      id: track.id,
      title: track.title,
      artist: track.artist,
      artworkUrl: track.artworkUrl,
      streamUrl: track.streamUrl,
      mediaType: "AUDIUS",
      duration: track.duration,
    });
    setSuggestedTrackIds((prev) => new Set(prev).add(track.id));
  };

  const handlePlayYouTube = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ytUrl.trim()) return;

    if (isHost) {
      onPlayMedia({
        url: ytUrl.trim(),
        title: "YouTube Video",
        mediaType: "YOUTUBE",
      });
      onClose();
    } else {
      onSuggestMedia({
        id: `yt-${Date.now()}`,
        title: ytUrl.trim(),
        url: ytUrl.trim(),
        mediaType: "YOUTUBE",
      });
      alert("YouTube video suggested to host!");
      setYtUrl("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="clay-card-elevated w-full max-w-3xl h-[620px] max-h-[90vh] flex flex-col rounded-3xl border border-white/10 shadow-2xl overflow-hidden bg-[#0c0d15]/95">
        {/* Modal Top Bar */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0e0f1a]/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl clay-pill flex items-center justify-center text-brand-400">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Room Media Hub</h3>
              <p className="text-[11px] text-zinc-400">
                {isHost ? "Stream Audius tracks or YouTube videos" : "Suggest songs and videos to the host"}
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 clay-pill p-1">
            <button
              type="button"
              onClick={() => setActiveTab("audius")}
              className={`px-3 py-1 text-xs rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "audius" ? "bg-clay-elevated text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-brand-400" />
              <span>Audius Music</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("youtube")}
              className={`px-3 py-1 text-xs rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "youtube" ? "bg-clay-elevated text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Video className="w-3.5 h-3.5 text-red-400" />
              <span>YouTube</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("queue")}
              className={`relative px-3 py-1 text-xs rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "queue" ? "bg-clay-elevated text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              <ListMusic className="w-3.5 h-3.5 text-emerald-400" />
              <span>Song Queue</span>
              {queue.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-brand-500 text-black text-[9px] font-bold flex items-center justify-center ml-0.5">
                  {queue.length}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 1: Audius Music Explorer */}
        {activeTab === "audius" && (
          <div className="flex-1 flex flex-col overflow-hidden p-5 gap-4">
            {/* Search Input & Genre Pills */}
            <div className="space-y-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search millions of tracks on Audius (Synthwave, Lofi, EDM, Artists)..."
                  className="w-full pl-10 pr-4 py-2.5 clay-input text-xs"
                />
              </div>

              {!searchQuery && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {GENRE_PILLS.map((genre) => (
                    <button
                      key={genre.value}
                      type="button"
                      onClick={() => setSelectedGenre(genre.value)}
                      className={`px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedGenre === genre.value
                          ? "bg-brand-500 text-black font-semibold shadow-sm"
                          : "clay-pill text-zinc-400 hover:text-white"
                      }`}
                    >
                      {genre.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tracks List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loading ? (
                <div className="text-center py-20 text-xs text-zinc-500 animate-pulse">
                  Searching open Audius music repository...
                </div>
              ) : tracks.length === 0 ? (
                <div className="text-center py-20 text-xs text-zinc-500">
                  No tracks found. Try searching for "lofi", "ambient", or "synthwave".
                </div>
              ) : (
                tracks.map((track) => {
                  const isPreviewing = previewTrackId === track.id;
                  const isSuggested = suggestedTrackIds.has(track.id);

                  return (
                    <div
                      key={track.id}
                      className="clay-card p-2.5 rounded-2xl flex items-center justify-between gap-3 group hover:border-white/15 transition-all"
                    >
                      {/* Left: Artwork & Details */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative w-12 h-12 rounded-xl bg-zinc-900 overflow-hidden shrink-0 border border-white/5 flex items-center justify-center">
                          {track.artworkUrl ? (
                            <img
                              src={track.artworkUrl}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Music className="w-5 h-5 text-zinc-600" />
                          )}

                          {/* Quick 5s Preview Button */}
                          <button
                            type="button"
                            onClick={() => togglePreview(track)}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title={isPreviewing ? "Stop Preview" : "Preview Track"}
                          >
                            {isPreviewing ? (
                              <Pause className="w-4 h-4 text-brand-400 fill-current" />
                            ) : (
                              <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                            )}
                          </button>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-semibold text-white truncate">{track.title}</h4>
                          <p className="text-[11px] text-zinc-400 truncate">
                            {track.artist} &bull;{" "}
                            <span className="text-zinc-500 font-mono">{track.genre}</span>
                          </p>
                        </div>
                      </div>

                      {/* Right Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isHost ? (
                          <button
                            type="button"
                            onClick={() => handlePlayAudius(track)}
                            className="clay-btn-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Play Now</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSuggestAudius(track)}
                            disabled={isSuggested}
                            className={`px-3 py-1.5 text-xs rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                              isSuggested
                                ? "clay-pill text-emerald-400 bg-emerald-950/40 border border-emerald-900/40"
                                : "clay-btn-secondary text-zinc-200 hover:text-white"
                            }`}
                          >
                            {isSuggested ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Suggested</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Suggest to Host</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: YouTube Video Link */}
        {activeTab === "youtube" && (
          <div className="flex-1 p-6 flex flex-col justify-center max-w-lg mx-auto w-full gap-5">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl clay-pill flex items-center justify-center mx-auto text-red-400 mb-2">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Stream YouTube Media</h3>
              <p className="text-xs text-zinc-400">
                Paste any standard YouTube video URL or 24/7 live stream to sync with roommates.
              </p>
            </div>

            <form onSubmit={handlePlayYouTube} className="space-y-3">
              <input
                type="url"
                required
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-3 text-xs clay-input"
              />

              <button
                type="submit"
                className="w-full py-3 clay-btn-primary text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isHost ? "Stream for Everyone" : "Suggest Video to Host"}</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Song Suggestion Queue */}
        {activeTab === "queue" && (
          <div className="flex-1 flex flex-col overflow-hidden p-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-400" />
                Suggested by Roommates ({queue.length})
              </span>
              <span className="text-[11px] text-zinc-500">
                {isHost ? "Approve suggestions to play in room" : "Songs suggested to the host"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pt-3">
              {queue.length === 0 ? (
                <div className="text-center py-24 text-xs text-zinc-500">
                  No suggestions in queue yet. Roommates can suggest tracks from Audius!
                </div>
              ) : (
                queue.map((item) => (
                  <div
                    key={item.id}
                    className="clay-card p-3 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-zinc-900 overflow-hidden shrink-0 border border-white/5 flex items-center justify-center">
                        {item.track.artworkUrl ? (
                          <img
                            src={item.track.artworkUrl}
                            alt={item.track.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music className="w-4 h-4 text-zinc-600" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-white truncate">{item.track.title}</h4>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {item.track.artist || "YouTube Stream"} &bull;{" "}
                          <span className="text-brand-400 font-medium">
                            Suggested by @{item.suggestedBy?.username}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => {
                            onPlayMedia({
                              url: item.track.streamUrl || item.track.url || "",
                              title: item.track.title,
                              artist: item.track.artist,
                              artworkUrl: item.track.artworkUrl,
                              mediaType: item.track.mediaType || "AUDIUS",
                              duration: item.track.duration,
                            });
                            onDismissSuggestion(item.id);
                            onClose();
                          }}
                          className="clay-btn-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play Now</span>
                        </button>
                      )}

                      {(isHost || item.suggestedBy?.id === item.id) && (
                        <button
                          type="button"
                          onClick={() => onDismissSuggestion(item.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
