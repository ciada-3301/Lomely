"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getSocket } from "@/lib/socket";
import SyncPlayer from "@/components/room/SyncPlayer";
import ParticipantTile from "@/components/room/ParticipantTile";
import InviteModal from "@/components/room/InviteModal";
import MediaHubModal, { SongSuggestion } from "@/components/room/MediaHubModal";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MessageSquare,
  Users,
  UserPlus,
  PhoneOff,
  Lock,
  Globe,
  ArrowLeft,
  X,
  Send,
  Copy,
  Check,
  PlaySquare,
  LayoutGrid,
  Tv,
  Columns,
  Radio,
} from "lucide-react";
import Link from "next/link";

interface RoomData {
  id: string;
  code: string;
  name: string;
  description: string;
  isPublic: boolean;
  hostId: string;
  currentMediaUrl: string | null;
  currentMediaTitle: string | null;
  currentArtist?: string | null;
  currentArtworkUrl?: string | null;
  currentMediaType?: "AUDIUS" | "YOUTUBE" | null;
  host: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  participants: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      username: string;
      avatarUrl: string | null;
      status: string;
    };
  }>;
}

interface PeerInfo {
  socketId: string;
  user: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
}

interface ChatMessage {
  id?: string;
  content: string;
  createdAt: string | Date;
  sender: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
}

export default function RoomDetailPage() {
  const params = useParams();
  const roomCode = params.code as string;
  const router = useRouter();
  const { user } = useAuth();

  // Room state
  const [room, setRoom] = useState<RoomData | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("MEMBER");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Google Meet Experience: Lobby vs Inside Room
  const [hasEnteredRoom, setHasEnteredRoom] = useState(false);
  const [guestName, setGuestName] = useState("");

  // Room Layout Mode: "filmstrip" (top cam row + video) | "sidebar" (video left + cam right) | "grid" (full cams) | "cinema" (full video)
  const [layoutMode, setLayoutMode] = useState<"filmstrip" | "sidebar" | "grid" | "cinema">("filmstrip");
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  // Floating Popup: Chat or Roommates
  const [activePopup, setActivePopup] = useState<"chat" | "roommates" | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Modals & Queues
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [mediaHubOpen, setMediaHubOpen] = useState(false);
  const [songQueue, setSongQueue] = useState<SongSuggestion[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);

  // WebRTC States
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peers, setPeers] = useState<Map<string, PeerInfo>>(new Map());

  // Streams in React state for instant reactivity
  const [lobbyStream, setLobbyStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  // Refs for WebRTC connections
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // In-Room Chat Stream
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const socketRef = useRef<any>(null);

  const effectiveUser = user || (guestName ? { id: `guest-${guestName}`, username: guestName, avatarUrl: "" } : null);
  const userRef = useRef(effectiveUser);
  userRef.current = effectiveUser;
  const roomRef = useRef(room);
  roomRef.current = room;

  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  // 1. Fetch Room Data
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomCode}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Room could not be loaded");
        }

        setRoom(data.room);
        setCurrentUserRole(data.currentUserRole);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (roomCode) {
      fetchRoom();
    }
  }, [roomCode]);

  // 2. Fetch Chat History
  useEffect(() => {
    if (!roomCode) return;
    const loadMessages = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomCode}/messages`);
        if (res.ok) {
          const data = await res.json();
          setChatMessages(data.messages || []);
        }
      } catch {}
    };
    loadMessages();
  }, [roomCode]);

  // 3. Lobby Camera Toggle
  const toggleLobbyCamera = async () => {
    if (isVideoOn) {
      if (lobbyStream) {
        lobbyStream.getTracks().forEach((t) => t.stop());
      }
      setLobbyStream(null);
      setIsVideoOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        setLobbyStream(stream);
        setIsVideoOn(true);
      } catch (err) {
        console.error("Lobby camera error:", err);
        alert("Camera permission denied or camera not found.");
        setIsVideoOn(false);
      }
    }
  };

  // 4. Initialize Socket, WebRTC, and Serverless Signaling Fallback
  useEffect(() => {
    if (!hasEnteredRoom || !roomCode || !userRef.current) return;

    const socket = getSocket();
    socketRef.current = socket;
    const currentUser = userRef.current;

    // Join room via socket
    socket.emit("room:join", {
      roomCode: roomCode,
      user: {
        id: currentUser.id,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
      },
    });

    // Helper: Dispatch signaling messages via Socket.IO or HTTP fallback
    const dispatchSignal = (targetId: string, signalData: any) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("webrtc:signal", {
          targetSocketId: targetId,
          signalData,
        });
      } else {
        fetch(`/api/rooms/${roomCode}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toUserId: targetId,
            signalData,
            fromUserId: currentUser.id,
            fromUsername: currentUser.username,
          }),
        }).catch(() => {});
      }
    };

    // Smooth media acquisition: reuse active lobby track, isolate audio/video
    const initMediaAndMesh = async () => {
      let audioTrack: MediaStreamTrack | null = null;
      let videoTrack: MediaStreamTrack | null = null;

      // 1. If lobby already had an active video track, preserve it directly
      if (lobbyStream && isVideoOn) {
        const liveVideo = lobbyStream.getVideoTracks().find((t) => t.readyState === "live");
        if (liveVideo) {
          videoTrack = liveVideo;
        }
      }

      // 2. Request microphone
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioTrack = audioStream.getAudioTracks()[0] || null;
        if (audioTrack) {
          audioTrack.enabled = !isMuted;
        }
      } catch (err) {
        console.warn("Microphone not available or permission denied:", err);
      }

      // 3. If user requested video and no video track was available from lobby, request camera
      if (isVideoOn && !videoTrack) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          videoTrack = videoStream.getVideoTracks()[0] || null;
        } catch (err) {
          console.warn("Camera not available or permission denied:", err);
          setIsVideoOn(false);
        }
      }

      const activeTracks: MediaStreamTrack[] = [];
      if (audioTrack) activeTracks.push(audioTrack);
      if (videoTrack) activeTracks.push(videoTrack);

      const stream = new MediaStream(activeTracks);
      localStreamRef.current = stream;
      setLocalStream(new MediaStream(stream.getTracks()));

      socket.emit("webrtc:join", {
        roomCode: roomCode,
        user: currentUser,
        mediaStatus: {
          isMuted: isMuted || !audioTrack,
          isVideoOn: Boolean(videoTrack),
          isScreenSharing: false,
        },
      });
    };

    initMediaAndMesh();

    // Create RTCPeerConnection for a peer (by socketId or userId)
    const createPeer = (targetPeerId: string, initiator: boolean) => {
      if (peerConnections.current.has(targetPeerId)) {
        return peerConnections.current.get(targetPeerId)!;
      }

      const pc = new RTCPeerConnection(iceServers);

      // Add existing local tracks or transceivers for bi-directional negotiation
      const audioTrack = localStreamRef.current?.getAudioTracks()[0];
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];

      if (audioTrack) {
        pc.addTrack(audioTrack, localStreamRef.current!);
      } else {
        pc.addTransceiver("audio", { direction: "sendrecv" });
      }

      if (videoTrack) {
        pc.addTrack(videoTrack, localStreamRef.current!);
      } else {
        pc.addTransceiver("video", { direction: "sendrecv" });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          dispatchSignal(targetPeerId, {
            type: "candidate",
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        const incomingStream =
          event.streams && event.streams[0]
            ? event.streams[0]
            : new MediaStream([event.track]);

        setRemoteStreams((prev) => {
          const next = new Map(prev);
          const existing = next.get(targetPeerId);
          if (existing) {
            if (!existing.getTracks().some((t) => t.id === event.track.id)) {
              existing.addTrack(event.track);
            }
            next.set(targetPeerId, new MediaStream(existing.getTracks()));
            return next;
          }
          next.set(targetPeerId, incomingStream);
          return next;
        });
      };

      if (initiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            dispatchSignal(targetPeerId, {
              type: "offer",
              sdp: pc.localDescription,
            });
          })
          .catch((err) => console.error("WebRTC offer error:", err));
      }

      peerConnections.current.set(targetPeerId, pc);
      return pc;
    };

    const handleSignal = async ({ senderId, signalData }: { senderId: string; signalData: any }) => {
      if (!senderId || !signalData) return;
      let pc = peerConnections.current.get(senderId);
      if (!pc) {
        pc = createPeer(senderId, false);
      }

      try {
        if (signalData.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          const queued = pendingIceCandidates.current.get(senderId) || [];
          for (const cand of queued) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch {}
          }
          pendingIceCandidates.current.delete(senderId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          dispatchSignal(senderId, {
            type: "answer",
            sdp: pc.localDescription,
          });
        } else if (signalData.type === "answer") {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
            const queued = pendingIceCandidates.current.get(senderId) || [];
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch {}
            }
            pendingIceCandidates.current.delete(senderId);
          }
        } else if (signalData.type === "candidate") {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
          } else {
            const list = pendingIceCandidates.current.get(senderId) || [];
            list.push(signalData.candidate);
            pendingIceCandidates.current.set(senderId, list);
          }
        } else if (signalData.type === "status") {
          setPeers((prev) => {
            const map = new Map(prev);
            const existing = map.get(senderId);
            if (existing) {
              map.set(senderId, {
                ...existing,
                isMuted: signalData.status?.isMuted !== undefined ? signalData.status.isMuted : existing.isMuted,
                isVideoOn: signalData.status?.isVideoOn !== undefined ? signalData.status.isVideoOn : existing.isVideoOn,
                isScreenSharing: signalData.status?.isScreenSharing !== undefined ? signalData.status.isScreenSharing : existing.isScreenSharing,
              });
            }
            return map;
          });
        }
      } catch (err) {
        console.warn("Signal handling warning:", err);
      }
    };

    const handleAllPeers = (allPeers: PeerInfo[]) => {
      const map = new Map();
      allPeers.forEach((p) => {
        if (p.socketId === socket.id || p.user?.id === currentUser?.id || p.user?.username === currentUser?.username) return;
        map.set(p.socketId, p);
        createPeer(p.socketId, true);
      });
      setPeers(map);
    };

    const handlePeerJoined = (newPeer: PeerInfo) => {
      if (newPeer.socketId === socket.id || newPeer.user?.id === currentUser?.id || newPeer.user?.username === currentUser?.username) return;
      setPeers((prev) => {
        const map = new Map(prev);
        map.set(newPeer.socketId, newPeer);
        return map;
      });
      createPeer(newPeer.socketId, false);
    };

    const handleSocketSignal = ({ senderSocketId, signalData }: any) => {
      handleSignal({ senderId: senderSocketId, signalData });
    };

    const handleParticipantUpdated = (info: PeerInfo) => {
      if (info.socketId === socket.id || info.user?.id === currentUser?.id || info.user?.username === currentUser?.username) return;
      setPeers((prev) => {
        const map = new Map(prev);
        map.set(info.socketId, info);
        return map;
      });
    };

    const handlePeerLeft = ({ socketId }: any) => {
      setPeers((prev) => {
        const map = new Map(prev);
        map.delete(socketId);
        return map;
      });
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
      const pc = peerConnections.current.get(socketId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(socketId);
      }
    };

    const handleNewMessage = (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      if (activePopup !== "chat") {
        setUnreadChatCount((prev) => prev + 1);
      }
    };

    const handleQueueUpdated = ({ queue }: { queue: SongSuggestion[] }) => {
      setSongQueue(queue || []);
    };

    const handleMediaSyncState = (mediaState: any) => {
      if (mediaState?.url) {
        setRoom((prev) => {
          if (!prev) return null;
          if (
            prev.currentMediaUrl === mediaState.url &&
            prev.currentMediaTitle === mediaState.title &&
            prev.currentArtist === mediaState.artist &&
            prev.currentArtworkUrl === mediaState.artworkUrl &&
            prev.currentMediaType === mediaState.mediaType
          ) {
            return prev;
          }
          return {
            ...prev,
            currentMediaUrl: mediaState.url,
            currentMediaTitle: mediaState.title,
            currentArtist: mediaState.artist,
            currentArtworkUrl: mediaState.artworkUrl,
            currentMediaType: mediaState.mediaType,
          };
        });
      }
    };

    socket.on("webrtc:all-peers", handleAllPeers);
    socket.on("webrtc:peer-joined", handlePeerJoined);
    socket.on("webrtc:signal", handleSocketSignal);
    socket.on("webrtc:participant-updated", handleParticipantUpdated);
    socket.on("webrtc:peer-left", handlePeerLeft);
    socket.on("room:message:received", handleNewMessage);
    socket.on("media:suggest:queue:updated", handleQueueUpdated);
    socket.on("media:sync:state", handleMediaSyncState);

    // 1. Join room in database immediately upon entering
    fetch(`/api/rooms/${roomCode}/join`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.participants) {
          setRoom((prev) => (prev ? { ...prev, participants: data.participants } : null));
        }
      })
      .catch(() => {});

    // 2. Serverless sync interval: poll HTTP signals & refresh DB participants
    const syncInterval = setInterval(async () => {
      if (!currentUser?.id) return;

      // A. If sockets are disconnected, poll serverless signals
      if (!socketRef.current?.connected) {
        try {
          const sigRes = await fetch(
            `/api/rooms/${roomCode}/signal?userId=${encodeURIComponent(currentUser.id)}`
          );
          if (sigRes.ok) {
            const sigData = await sigRes.json();
            if (sigData.signals && sigData.signals.length > 0) {
              for (const envelope of sigData.signals) {
                await handleSignal({
                  senderId: envelope.fromUserId,
                  signalData: envelope.signalData,
                });
              }
            }
          }
        } catch {}

        // Poll chat messages fallback
        try {
          const chatRes = await fetch(`/api/rooms/${roomCode}/messages`);
          if (chatRes.ok) {
            const cData = await chatRes.json();
            if (cData.messages) {
              setChatMessages((prev) => {
                if (cData.messages.length > prev.length) {
                  return cData.messages;
                }
                return prev;
              });
            }
          }
        } catch {}
      }

      // B. Refresh participants from database and establish WebRTC mesh
      try {
        const roomRes = await fetch(`/api/rooms/${roomCode}`);
        if (roomRes.ok) {
          const rData = await roomRes.json();
          if (rData.room && rData.room.participants) {
            setRoom((prev) => (prev ? { ...prev, participants: rData.room.participants } : null));

            rData.room.participants.forEach((p: any) => {
              const pId = p.user?.id;
              if (!pId || pId === currentUser.id || p.user?.username === currentUser.username) return;

              // Ensure in peers map
              setPeers((prev) => {
                const next = new Map(prev);
                if (!next.has(pId)) {
                  next.set(pId, {
                    socketId: pId,
                    user: p.user,
                    isMuted: !p.isVoiceActive,
                    isVideoOn: Boolean(p.isVideoActive),
                    isScreenSharing: Boolean(p.isScreenSharing),
                  });
                }
                return next;
              });

              // If no peer connection exists yet, create one (lower ID initiates)
              if (!peerConnections.current.has(pId)) {
                const shouldInitiate = currentUser.id < pId;
                createPeer(pId, shouldInitiate);
              }
            });
          }
        }
      } catch {}
    }, 2000);

    return () => {
      clearInterval(syncInterval);
      fetch(`/api/rooms/${roomCode}/leave`, { method: "POST" }).catch(() => {});

      socket.off("webrtc:all-peers", handleAllPeers);
      socket.off("webrtc:peer-joined", handlePeerJoined);
      socket.off("webrtc:signal", handleSocketSignal);
      socket.off("webrtc:participant-updated", handleParticipantUpdated);
      socket.off("webrtc:peer-left", handlePeerLeft);
      socket.off("room:message:received", handleNewMessage);
      socket.off("media:suggest:queue:updated", handleQueueUpdated);
      socket.off("media:sync:state", handleMediaSyncState);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();

      socket.emit("room:leave", { roomCode: roomCode, user: userRef.current });
      socket.emit("webrtc:leave", { roomCode: roomCode });
    };
  }, [hasEnteredRoom, roomCode, effectiveUser?.id]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, activePopup]);

  // Helper: Dispatch status change (mute, camera, screenshare) to peers
  const dispatchStatusChange = (status: { isMuted?: boolean; isVideoOn?: boolean; isScreenSharing?: boolean }) => {
    socketRef.current?.emit("webrtc:status-change", {
      roomCode: room?.code,
      mediaStatus: status,
    });

    if (!socketRef.current?.connected && effectiveUser) {
      peerConnections.current.forEach((_, targetId) => {
        fetch(`/api/rooms/${roomCode}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toUserId: targetId,
            signalData: { type: "status", status },
            fromUserId: effectiveUser.id,
            fromUsername: effectiveUser.username,
          }),
        }).catch(() => {});
      });
    }
  };

  // Controls: Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audio = localStreamRef.current.getAudioTracks()[0];
      if (audio) {
        audio.enabled = !audio.enabled;
        const next = !audio.enabled;
        setIsMuted(next);
        dispatchStatusChange({ isMuted: next });
        return;
      }
    }
    const next = !isMuted;
    setIsMuted(next);
    dispatchStatusChange({ isMuted: next });
  };

  // Controls: Camera Video Toggle (Robust track replacement)
  const toggleCamera = async () => {
    if (isVideoOn) {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          if (!track.label?.toLowerCase().includes("screen")) {
            track.stop();
            localStreamRef.current?.removeTrack(track);
          }
        });
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      if (!isScreenSharing) {
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(null);
          }
        });
      }

      setIsVideoOn(false);
      dispatchStatusChange({ isVideoOn: false });
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        const videoTrack = videoStream.getVideoTracks()[0];

        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach((t) => {
            if (!t.label?.toLowerCase().includes("screen")) {
              t.stop();
              localStreamRef.current?.removeTrack(t);
            }
          });
          localStreamRef.current.addTrack(videoTrack);
        } else {
          localStreamRef.current = videoStream;
        }

        // Update localStream state to re-render local ParticipantTile
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        // Update remote peer connections if not actively screen sharing
        if (!isScreenSharing) {
          peerConnections.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender) {
              sender.replaceTrack(videoTrack);
            } else {
              pc.addTrack(videoTrack, localStreamRef.current!);
            }
          });
        }

        setIsVideoOn(true);
        dispatchStatusChange({ isVideoOn: true });
      } catch (err) {
        console.error("Camera error inside room:", err);
        alert("Camera access denied or camera busy. Check browser permissions.");
        setIsVideoOn(false);
      }
    }
  };

  // Controls: Screen Share
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      const track = localStreamRef.current?.getVideoTracks().find((t) => t.label.includes("screen") || isScreenSharing);
      if (track) {
        track.stop();
        localStreamRef.current?.removeTrack(track);
      }
      setIsScreenSharing(false);

      // Revert to camera video if camera was enabled
      const camTrack = isVideoOn ? localStreamRef.current?.getVideoTracks()[0] || null : null;
      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(camTrack);
        }
      });

      setLocalStream(localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null);
      dispatchStatusChange({ isScreenSharing: false, isVideoOn });
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = stream.getVideoTracks()[0];

        screenTrack.onended = () => {
          setIsScreenSharing(false);
          const camTrack = isVideoOn ? localStreamRef.current?.getVideoTracks()[0] || null : null;
          peerConnections.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender) {
              sender.replaceTrack(camTrack);
            }
          });
          setLocalStream(localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null);
          dispatchStatusChange({ isScreenSharing: false, isVideoOn });
        };

        if (localStreamRef.current) {
          localStreamRef.current.addTrack(screenTrack);
        } else {
          localStreamRef.current = stream;
        }

        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(screenTrack);
          } else {
            pc.addTrack(screenTrack, localStreamRef.current!);
          }
        });

        setIsScreenSharing(true);
        dispatchStatusChange({ isScreenSharing: true });
      } catch (err) {
        console.error("Screen share error:", err);
      }
    }
  };

  // Send In-Room Message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !effectiveUser || !room) return;

    const content = chatInput.trim();
    setChatInput("");

    const newMsg: ChatMessage = {
      content,
      createdAt: new Date().toISOString(),
      sender: {
        id: effectiveUser.id,
        username: effectiveUser.username,
        avatarUrl: effectiveUser.avatarUrl,
      },
    };

    socketRef.current?.emit("room:message:send", {
      roomCode: room.code,
      message: newMsg,
    });

    try {
      await fetch(`/api/rooms/${room.code}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    } catch {}
  };

  // Play media directly (Host action)
  const handlePlayMedia = async ({
    url,
    title,
    artist,
    artworkUrl,
    mediaType,
    duration,
  }: {
    url: string;
    title: string;
    artist?: string;
    artworkUrl?: string | null;
    mediaType: "AUDIUS" | "YOUTUBE";
    duration?: number;
  }) => {
    if (!room) return;

    setRoom((prev) =>
      prev
        ? {
            ...prev,
            currentMediaUrl: url,
            currentMediaTitle: title,
            currentArtist: artist || null,
            currentArtworkUrl: artworkUrl || null,
            currentMediaType: mediaType,
          }
        : null
    );

    socketRef.current?.emit("media:change", {
      roomCode: room.code,
      url,
      title,
      artist,
      artworkUrl,
      mediaType,
      duration,
    });

    try {
      await fetch(`/api/rooms/${room.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentMediaUrl: url,
          currentMediaTitle: title,
        }),
      });
    } catch (err) {
      console.error("Failed to persist media in room:", err);
    }

    setMediaHubOpen(false);
  };

  // Suggest media (Roommate action)
  const handleSuggestMedia = (track: {
    id: string;
    title: string;
    artist?: string;
    artworkUrl?: string | null;
    streamUrl?: string;
    url?: string;
    mediaType?: "AUDIUS" | "YOUTUBE";
    duration?: number;
  }) => {
    if (!room || !effectiveUser) return;
    socketRef.current?.emit("media:suggest:track", {
      roomCode: room.code,
      track,
      suggestedBy: {
        id: effectiveUser.id,
        username: effectiveUser.username,
        avatarUrl: effectiveUser.avatarUrl,
      },
    });
  };

  // Dismiss suggestion from queue
  const handleDismissSuggestion = (suggestionId: string) => {
    if (!room) return;
    socketRef.current?.emit("media:suggest:dismiss", {
      roomCode: room.code,
      suggestionId,
    });
  };

  const handleCopyCode = () => {
    if (!room) return;
    const url = `${window.location.origin}/room/${room.code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleLeaveRoom = () => {
    if (confirm("Leave this room session?")) {
      router.push("/rooms");
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#07080c] flex items-center justify-center font-sans text-xs text-zinc-500 animate-pulse">
        Initializing room session...
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="fixed inset-0 z-50 bg-[#07080c] flex items-center justify-center p-6">
        <div className="clay-card-elevated p-8 text-center max-w-md space-y-4">
          <div className="w-12 h-12 rounded-2xl clay-pill flex items-center justify-center mx-auto text-red-400">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-white">Room Restricted</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {error || "This closed room requires an invite from the host."}
          </p>
          <div className="pt-2">
            <Link href="/rooms" className="clay-btn-secondary px-4 py-2 text-xs inline-block">
              Return to Rooms
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 1. GOOGLE MEET STYLE PRE-JOIN LOBBY (Green Room)
  // =========================================================================
  if (!hasEnteredRoom) {
    return (
      <div className="fixed inset-0 z-50 bg-[#07080c] flex flex-col justify-between p-4 sm:p-8 overflow-y-auto">
        {/* Lobby Top Navigation */}
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/rooms"
            className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Leave Lobby</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-500 shadow-glow" />
            <span className="text-xs font-bold text-white">Lomely Space</span>
          </div>
        </div>

        {/* Center Lobby Card Container */}
        <div className="w-full max-w-4xl mx-auto my-auto py-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left Preview Box (Mic & Camera Check) */}
          <div className="md:col-span-7 flex flex-col items-center">
            <div className="relative aspect-video w-full max-w-md rounded-3xl bg-clay-sunken overflow-hidden shadow-clay-elevated border border-white/5 flex flex-col items-center justify-center p-3">
              <ParticipantTile
                username={effectiveUser?.username || "You"}
                stream={lobbyStream}
                isLocal={true}
                isVideoOn={isVideoOn}
                isMuted={isMuted}
                className="w-full h-full"
              />

              {/* Lobby Quick Toggles (Mic & Camera) */}
              <div className="absolute bottom-4 flex items-center gap-3 z-20">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-3 rounded-full transition-all shadow-md ${
                    isMuted ? "bg-red-950/90 text-red-400" : "clay-btn-secondary text-white"
                  }`}
                  title={isMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={toggleLobbyCamera}
                  className={`p-3 rounded-full transition-all shadow-md ${
                    isVideoOn ? "clay-btn-primary" : "clay-btn-secondary text-white"
                  }`}
                  title={isVideoOn ? "Turn Off Camera" : "Turn On Camera"}
                >
                  {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 mt-3">
              Check your camera and audio before stepping inside.
            </p>
          </div>

          {/* Right Lobby Join Action Card */}
          <div className="md:col-span-5 clay-card-elevated p-6 sm:p-8 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="clay-pill px-2.5 py-0.5 text-[11px] text-brand-400 font-medium">
                  {room.isPublic ? "Public Room" : "Closed Room"}
                </span>
                <span className="text-xs text-zinc-500">#{room.code}</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {room.name}
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                {room.description || "Synchronized theater and voice space."}
              </p>
            </div>

            {/* Roommate presence in room */}
            <div className="clay-card p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-zinc-400" />
                  Currently inside
                </span>
                <span className="clay-pill px-2 py-0.5 text-[10px] text-emerald-400">
                  {room.participants.length} Active
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                {room.participants.map((p) => (
                  <div
                    key={p.id}
                    className="clay-pill px-2.5 py-1 text-xs text-zinc-300 flex items-center gap-1.5 shrink-0"
                  >
                    <div className="w-4 h-4 rounded-full bg-clay-elevated flex items-center justify-center text-[9px] font-bold text-white">
                      {p.user.username.charAt(0).toUpperCase()}
                    </div>
                    <span>@{p.user.username}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* If Guest (not logged in): Guest Name input */}
            {!user && (
              <div>
                <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                  Your Name (Joining as guest)
                </label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Maya"
                  className="w-full px-3.5 py-2.5 clay-input text-xs"
                />
              </div>
            )}

            {/* Big Google Meet Join Button */}
            <button
              onClick={() => {
                if (!user && !guestName.trim()) {
                  alert("Please enter a name to join the room");
                  return;
                }
                setHasEnteredRoom(true);
              }}
              className="w-full py-3.5 px-6 clay-btn-primary text-sm flex items-center justify-center gap-2 font-semibold"
            >
              Join Room Now
            </button>
          </div>
        </div>

        {/* Lobby Footer */}
        <div className="w-full max-w-5xl mx-auto text-center text-xs text-zinc-600">
          Lomely &bull; Private Room Container
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. DEDICATED GOOGLE MEET THEATER CONTAINER & CAMERA DISPLAY MODES
  // =========================================================================
  const isHost = user?.id === room.hostId || currentUserRole === "HOST";
  const hasMedia = Boolean(room.currentMediaUrl);

  // Collect all active participants (local + remote), filtering out any duplicate self instances
  const otherParticipants = Array.from(peers.values()).filter(
    (p) =>
      p.socketId !== socketRef.current?.id &&
      p.user?.id !== effectiveUser?.id &&
      p.user?.username !== effectiveUser?.username
  );

  const allParticipants = [
    {
      id: effectiveUser?.id || "local",
      username: effectiveUser?.username || "You",
      stream: localStream,
      isLocal: true,
      isMuted: isMuted,
      isVideoOn: isVideoOn,
      isScreenSharing: isScreenSharing,
    },
    ...otherParticipants.map((p) => {
      const pId = p.user?.id || p.socketId;
      const stream = remoteStreams.get(pId) || remoteStreams.get(p.socketId) || null;
      return {
        id: pId,
        username: p.user.username,
        stream,
        isLocal: false,
        isMuted: p.isMuted,
        isVideoOn: p.isVideoOn,
        isScreenSharing: p.isScreenSharing,
      };
    }),
  ];

  const pinnedParticipant = allParticipants.find((p) => p.id === pinnedId) || null;

  // Split participants between left and right wings around the cinema video
  // If 1 participant (You): left wing has You, right wing is empty
  // If 2 participants (You + Roommate): left wing has You, right wing has Roommate
  // If 3+ participants: split evenly across left and right wings
  const leftWingParticipants =
    allParticipants.length === 1
      ? allParticipants
      : allParticipants.filter((_, idx) => idx % 2 === 0);

  const rightWingParticipants =
    allParticipants.length === 1
      ? []
      : allParticipants.filter((_, idx) => idx % 2 === 1);

  return (
    <div className="fixed inset-0 z-50 bg-[#07080b] flex flex-col overflow-hidden select-none font-sans">
      {/* 1. TOP HEADER BAR (Compact h-12, Zero Wasted Space) */}
      <header className="h-12 px-4 sm:px-6 flex items-center justify-between border-b border-white/5 bg-[#090a10]/95 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setHasEnteredRoom(false)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Lobby settings"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-glow" />
            <h1 className="text-sm font-bold text-white tracking-tight truncate max-w-xs sm:max-w-md">
              {room.name}
            </h1>
          </div>

          <button
            onClick={handleCopyCode}
            title="Copy room link"
            className="clay-pill px-2.5 py-0.5 text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <span>{room.code}</span>
            {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 opacity-60" />}
          </button>
        </div>

        {/* Right Top Header Actions */}
        <div className="flex items-center gap-2">
          {/* Layout Mode Switcher */}
          <div className="hidden sm:flex items-center gap-1 clay-pill p-1">
            <button
              onClick={() => {
                setLayoutMode("filmstrip");
                setPinnedId(null);
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                layoutMode === "filmstrip" && !pinnedId ? "bg-clay-elevated text-brand-400" : "text-zinc-400 hover:text-white"
              }`}
              title="Flanked Theater Mode"
            >
              <Tv className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setLayoutMode("grid");
                setPinnedId(null);
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                layoutMode === "grid" && !pinnedId ? "bg-clay-elevated text-brand-400" : "text-zinc-400 hover:text-white"
              }`}
              title="Full People Grid"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Invite Button */}
          <button
            onClick={() => setInviteModalOpen(true)}
            className="clay-btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5 font-semibold"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invite</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN STAGE VIEWPORT (Full Height, Space Optimized) */}
      <main className="flex-1 relative flex items-center justify-center p-2 sm:p-3 overflow-hidden min-h-0 w-full">
        {/* Case A: Spotlight / Pinned Participant View */}
        {pinnedParticipant ? (
          <div className="w-full h-full flex flex-col justify-between max-w-6xl mx-auto gap-3">
            <div className="flex-1 w-full flex items-center justify-center min-h-0">
              <div className="w-full max-w-4xl h-full flex items-center justify-center">
                <ParticipantTile
                  username={pinnedParticipant.username}
                  stream={pinnedParticipant.stream}
                  isLocal={pinnedParticipant.isLocal}
                  isMuted={pinnedParticipant.isMuted}
                  isVideoOn={pinnedParticipant.isVideoOn}
                  isScreenSharing={pinnedParticipant.isScreenSharing}
                  isPinned={true}
                  onTogglePin={() => setPinnedId(null)}
                  className="w-full max-h-full"
                />
              </div>
            </div>

            {/* Bottom filmstrip of remaining participants */}
            <div className="w-full shrink-0 flex items-center justify-center gap-3 overflow-x-auto pb-1 px-1">
              {allParticipants.map((p) => (
                <div key={p.id} className="w-48 sm:w-56 shrink-0">
                  <ParticipantTile
                    username={p.username}
                    stream={p.stream}
                    isLocal={p.isLocal}
                    isMuted={p.isMuted}
                    isVideoOn={p.isVideoOn}
                    isScreenSharing={p.isScreenSharing}
                    isPinned={p.id === pinnedId}
                    onTogglePin={() => setPinnedId(pinnedId === p.id ? null : p.id)}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : hasMedia && layoutMode !== "grid" ? (
          /* Case B: Flanked Side Wings Layout (Cards on Left and Right of Video) */
          <div className="w-full h-full flex items-center justify-between gap-3 overflow-hidden">
            {/* Left Wing (Participants) */}
            {leftWingParticipants.length > 0 && (
              <div className="w-64 sm:w-72 md:w-80 lg:w-96 shrink-0 h-full flex flex-col justify-center gap-3 overflow-y-auto pr-1">
                {leftWingParticipants.map((p) => (
                  <div key={p.id} className="w-full shrink-0">
                    <ParticipantTile
                      username={p.username}
                      stream={p.stream}
                      isLocal={p.isLocal}
                      isMuted={p.isMuted}
                      isVideoOn={p.isVideoOn}
                      isScreenSharing={p.isScreenSharing}
                      isPinned={p.id === pinnedId}
                      onTogglePin={() => setPinnedId(pinnedId === p.id ? null : p.id)}
                      className="w-full shadow-lg"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Center Cinema Video (Maximized Space) */}
            <div className="flex-1 h-full min-w-0 flex items-center justify-center px-1">
              <SyncPlayer
                roomCode={room.code}
                isHost={isHost}
                isPublicRoom={room.isPublic}
                socket={socketRef.current}
                initialMediaUrl={room.currentMediaUrl}
                initialMediaTitle={room.currentMediaTitle}
                initialArtist={room.currentArtist}
                initialArtworkUrl={room.currentArtworkUrl}
                initialMediaType={room.currentMediaType}
                currentUser={effectiveUser ? { id: effectiveUser.id, username: effectiveUser.username } : null}
                onOpenMediaHub={() => setMediaHubOpen(true)}
              />
            </div>

            {/* Right Wing (Participants when 2+ people in room) */}
            {rightWingParticipants.length > 0 && (
              <div className="w-64 sm:w-72 md:w-80 lg:w-96 shrink-0 h-full flex flex-col justify-center gap-3 overflow-y-auto pl-1">
                {rightWingParticipants.map((p) => (
                  <div key={p.id} className="w-full shrink-0">
                    <ParticipantTile
                      username={p.username}
                      stream={p.stream}
                      isLocal={p.isLocal}
                      isMuted={p.isMuted}
                      isVideoOn={p.isVideoOn}
                      isScreenSharing={p.isScreenSharing}
                      isPinned={p.id === pinnedId}
                      onTogglePin={() => setPinnedId(pinnedId === p.id ? null : p.id)}
                      className="w-full shadow-lg"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Case C: Full Adaptive People Grid (No Video, or Grid Mode) */
          <div className="w-full h-full flex flex-col items-center justify-center p-2">
            <div
              className={`w-full grid gap-4 max-h-[82vh] ${
                allParticipants.length === 1
                  ? "grid-cols-1 max-w-3xl"
                  : allParticipants.length === 2
                  ? "grid-cols-1 md:grid-cols-2 max-w-5xl"
                  : allParticipants.length <= 4
                  ? "grid-cols-2 max-w-5xl"
                  : "grid-cols-2 sm:grid-cols-3 max-w-6xl"
              }`}
            >
              {allParticipants.map((p) => (
                <div key={p.id} className="w-full flex items-center justify-center">
                  <ParticipantTile
                    username={p.username}
                    stream={p.stream}
                    isLocal={p.isLocal}
                    isMuted={p.isMuted}
                    isVideoOn={p.isVideoOn}
                    isScreenSharing={p.isScreenSharing}
                    isPinned={p.id === pinnedId}
                    onTogglePin={() => setPinnedId(pinnedId === p.id ? null : p.id)}
                    className="w-full shadow-lg"
                  />
                </div>
              ))}
            </div>

            {hasMedia && (
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLayoutMode("filmstrip");
                    setPinnedId(null);
                  }}
                  className="clay-pill px-4 py-2 text-xs text-brand-400 flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Tv className="w-4 h-4" />
                  <span>Watch Party Active &bull; Return to Video</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 3. FLOATING CHAT & ROOMMATES POPUP MODAL (Wide, Long, Non-Intrusive) */}
      {activePopup && (
        <div className="fixed bottom-20 right-4 sm:right-6 w-[420px] sm:w-[460px] h-[540px] max-h-[calc(100vh-120px)] bg-[#0b0c13]/95 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Popup Header & Tabs */}
          <div className="p-3.5 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0e0f18]/80">
            <div className="flex items-center gap-1 clay-pill p-1">
              <button
                type="button"
                onClick={() => {
                  setActivePopup("chat");
                  setUnreadChatCount(0);
                }}
                className={`px-3 py-1 text-xs rounded-full transition-colors font-medium ${
                  activePopup === "chat" ? "bg-clay-elevated text-white shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
              >
                In-Room Chat
              </button>
              <button
                type="button"
                onClick={() => setActivePopup("roommates")}
                className={`px-3 py-1 text-xs rounded-full transition-colors font-medium ${
                  activePopup === "roommates" ? "bg-clay-elevated text-white shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
              >
                Roommates ({allParticipants.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActivePopup(null)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Close Popup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab 1: Chat Stream */}
          {activePopup === "chat" && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-20 text-xs text-zinc-500">
                    Welcome to {room.name}. Messages sent here stay in the room.
                  </div>
                ) : (
                  chatMessages.map((msg, i) => {
                    const isMe = msg.sender.id === effectiveUser?.id;
                    const time = new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <div key={i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        <div className="flex items-baseline gap-1.5 mb-0.5">
                          <span className="text-[11px] font-semibold text-zinc-300">
                            @{msg.sender.username}
                          </span>
                          <span className="text-[9px] text-zinc-500">{time}</span>
                        </div>
                        <div
                          className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs break-words ${
                            isMe ? "clay-btn-primary font-medium" : "clay-card text-zinc-200"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              <form onSubmit={handleSendChat} className="p-3 border-t border-white/5 flex items-center gap-2 bg-[#08090f]/90 shrink-0">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Send a message to everyone..."
                  className="flex-1 px-3.5 py-2 text-xs clay-input"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="clay-btn-primary p-2 disabled:opacity-40"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* Tab 2: Roommates List */}
          {activePopup === "roommates" && (
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              <div className="space-y-2">
                {allParticipants.map((p) => (
                  <div key={p.id} className="clay-card p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-clay-elevated text-zinc-100 font-bold flex items-center justify-center text-xs border border-white/5">
                        {p.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-zinc-200 font-medium">
                          @{p.username} {p.isLocal && "(You)"}
                        </span>
                        {p.username === room.host.username && (
                          <span className="text-[10px] text-brand-400 font-mono">Host</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {p.isMuted ? (
                        <span className="clay-pill p-1 text-red-400 bg-red-950/60 border border-red-900/40">
                          <MicOff className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="clay-pill p-1 text-emerald-400 bg-emerald-950/60 border border-emerald-900/40">
                          <Mic className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {p.isVideoOn ? (
                        <span className="clay-pill p-1 text-brand-400 bg-black/60 border border-white/10">
                          <Video className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="clay-pill p-1 text-zinc-600 bg-black/60 border border-white/5">
                          <VideoOff className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(true)}
                  className="w-full py-2.5 clay-btn-secondary text-xs flex items-center justify-center gap-2 font-medium"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Invite More Roommates
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. UNIFIED SINGLE DOCK (Integrated Video, Mic, Chat, Roommates, Leave) */}
      <footer className="h-16 px-4 flex items-center justify-center shrink-0 z-30">
        <div className="clay-card-elevated px-4 py-2 rounded-2xl flex items-center gap-2 sm:gap-2.5 border border-white/10 shadow-clay-elevated backdrop-blur-xl">
          {/* Microphone */}
          <button
            type="button"
            onClick={toggleMute}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              isMuted ? "bg-red-950/90 text-red-400 shadow-md border border-red-900/50" : "clay-btn-secondary text-white"
            }`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Camera */}
          <button
            type="button"
            onClick={toggleCamera}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              isVideoOn ? "clay-btn-primary" : "clay-btn-secondary text-white"
            }`}
            title={isVideoOn ? "Turn Off Camera" : "Turn On Camera"}
          >
            {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              isScreenSharing ? "clay-btn-primary" : "clay-btn-secondary text-white"
            }`}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
          >
            <MonitorUp className="w-5 h-5" />
          </button>

          {/* Media Hub (Audius Music, YouTube, Suggestions Queue) */}
          <button
            type="button"
            onClick={() => setMediaHubOpen(!mediaHubOpen)}
            className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              mediaHubOpen ? "clay-btn-primary text-black" : "clay-btn-secondary text-brand-400"
            }`}
            title="Open Media Hub (Audius Music & YouTube)"
          >
            <PlaySquare className="w-5 h-5" />
            {songQueue.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-500 text-black text-[9px] font-bold flex items-center justify-center shadow-md">
                {songQueue.length}
              </span>
            )}
          </button>

          <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

          {/* Chat Popup Toggle */}
          <button
            type="button"
            onClick={() => {
              setActivePopup(activePopup === "chat" ? null : "chat");
              setUnreadChatCount(0);
            }}
            className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              activePopup === "chat" ? "clay-btn-primary text-black" : "clay-btn-secondary text-zinc-300"
            }`}
            title="In-Room Chat"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadChatCount > 0 && activePopup !== "chat" && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-500 text-black text-[9px] font-bold flex items-center justify-center shadow-md">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Roommates / People Popup Toggle */}
          <button
            type="button"
            onClick={() => setActivePopup(activePopup === "roommates" ? null : "roommates")}
            className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              activePopup === "roommates" ? "clay-btn-primary text-black" : "clay-btn-secondary text-zinc-300"
            }`}
            title="Roommates"
          >
            <Users className="w-5 h-5" />
            <span className="absolute -bottom-1 -right-1 clay-pill px-1.5 py-0.2 text-[9px] text-zinc-300 font-mono bg-black/80">
              {allParticipants.length}
            </span>
          </button>

          <div className="h-6 w-px bg-white/10 mx-1" />

          {/* Leave Call (Red Button) */}
          <button
            type="button"
            onClick={handleLeaveRoom}
            className="px-4 h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg transition-colors"
            title="Leave Room"
          >
            <PhoneOff className="w-4 h-4" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </footer>

      {/* Invite Modal */}
      <InviteModal
        roomCode={room.code}
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      />

      {/* Media Hub Modal (Audius Music, YouTube, Queue) */}
      <MediaHubModal
        isOpen={mediaHubOpen}
        onClose={() => setMediaHubOpen(false)}
        isHost={isHost}
        isPublicRoom={room.isPublic}
        currentMediaTitle={room.currentMediaTitle}
        queue={songQueue}
        onPlayMedia={handlePlayMedia}
        onSuggestMedia={handleSuggestMedia}
        onDismissSuggestion={handleDismissSuggestion}
      />
    </div>
  );
}
