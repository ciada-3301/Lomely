"use client";

import React, { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneCall,
  PhoneOff,
  Activity,
} from "lucide-react";

interface UserProfile {
  id: string;
  username: string;
  avatarUrl?: string | null;
}

interface PeerInfo {
  socketId: string;
  user: UserProfile;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
}

interface VoiceChannelProps {
  roomCode: string;
  currentUser: UserProfile;
  socket: Socket | null;
}

export default function VoiceChannel({
  roomCode,
  currentUser,
  socket,
}: VoiceChannelProps) {
  const [inCall, setInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [peers, setPeers] = useState<Map<string, PeerInfo>>(new Map());

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const joinVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      localStreamRef.current = stream;
      setInCall(true);

      if (socket) {
        socket.emit("webrtc:join", {
          roomCode,
          user: currentUser,
          mediaStatus: {
            isMuted: false,
            isVideoOn: false,
            isScreenSharing: false,
          },
        });
      }
    } catch (err) {
      console.error("Mic access fallback:", err);
      setInCall(true);
      if (socket) {
        socket.emit("webrtc:join", {
          roomCode,
          user: currentUser,
          mediaStatus: {
            isMuted: true,
            isVideoOn: false,
            isScreenSharing: false,
          },
        });
      }
    }
  };

  const leaveVoice = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();

    setInCall(false);
    setIsVideoOn(false);
    setIsScreenSharing(false);
    setPeers(new Map());

    if (socket) {
      socket.emit("webrtc:leave", { roomCode });
    }
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const nextMuted = !audioTrack.enabled;
      setIsMuted(nextMuted);
      socket?.emit("webrtc:status-change", {
        roomCode,
        mediaStatus: { isMuted: nextMuted },
      });
    }
  };

  const toggleCamera = async () => {
    if (!inCall) return;

    if (isVideoOn) {
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        localStreamRef.current?.removeTrack(videoTrack);
      }
      setIsVideoOn(false);
      socket?.emit("webrtc:status-change", {
        roomCode,
        mediaStatus: { isVideoOn: false },
      });
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];

        if (localStreamRef.current) {
          localStreamRef.current.addTrack(videoTrack);
        } else {
          localStreamRef.current = videoStream;
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        peerConnections.current.forEach((pc) => {
          pc.addTrack(videoTrack, localStreamRef.current!);
        });

        setIsVideoOn(true);
        socket?.emit("webrtc:status-change", {
          roomCode,
          mediaStatus: { isVideoOn: true },
        });
      } catch (err) {
        console.error("Camera access error:", err);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!inCall) return;

    if (isScreenSharing) {
      const screenTrack = localStreamRef.current?.getVideoTracks()[0];
      if (screenTrack) {
        screenTrack.stop();
        localStreamRef.current?.removeTrack(screenTrack);
      }
      setIsScreenSharing(false);
      socket?.emit("webrtc:status-change", {
        roomCode,
        mediaStatus: { isScreenSharing: false },
      });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        screenTrack.onended = () => {
          setIsScreenSharing(false);
          socket?.emit("webrtc:status-change", {
            roomCode,
            mediaStatus: { isScreenSharing: false },
          });
        };

        if (localStreamRef.current) {
          localStreamRef.current.addTrack(screenTrack);
        } else {
          localStreamRef.current = screenStream;
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        peerConnections.current.forEach((pc) => {
          pc.addTrack(screenTrack, localStreamRef.current!);
        });

        setIsScreenSharing(true);
        socket?.emit("webrtc:status-change", {
          roomCode,
          mediaStatus: { isScreenSharing: true },
        });
      } catch (err) {
        console.error("Screen share error:", err);
      }
    }
  };

  useEffect(() => {
    if (!socket || !inCall) return;

    const createPeer = (targetSocketId: string, initiator: boolean) => {
      const pc = new RTCPeerConnection(iceServers);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc:signal", {
            targetSocketId,
            signalData: { type: "candidate", candidate: event.candidate },
          });
        }
      };

      pc.ontrack = (event) => {
        const remoteVideo = remoteVideoRefs.current.get(targetSocketId);
        if (remoteVideo && event.streams[0]) {
          remoteVideo.srcObject = event.streams[0];
        }
      };

      if (initiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit("webrtc:signal", {
              targetSocketId,
              signalData: { type: "offer", sdp: pc.localDescription },
            });
          });
      }

      peerConnections.current.set(targetSocketId, pc);
      return pc;
    };

    const handleAllPeers = (allPeers: PeerInfo[]) => {
      const newPeersMap = new Map();
      allPeers.forEach((p) => {
        newPeersMap.set(p.socketId, p);
        createPeer(p.socketId, true);
      });
      setPeers(newPeersMap);
    };

    const handlePeerJoined = (newPeer: PeerInfo) => {
      setPeers((prev) => {
        const updated = new Map(prev);
        updated.set(newPeer.socketId, newPeer);
        return updated;
      });
      createPeer(newPeer.socketId, false);
    };

    const handleSignal = async ({
      senderSocketId,
      signalData,
    }: {
      senderSocketId: string;
      signalData: any;
    }) => {
      let pc = peerConnections.current.get(senderSocketId);
      if (!pc) {
        pc = createPeer(senderSocketId, false);
      }

      if (signalData.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc:signal", {
          targetSocketId: senderSocketId,
          signalData: { type: "answer", sdp: pc.localDescription },
        });
      } else if (signalData.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
      } else if (signalData.type === "candidate") {
        await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      }
    };

    const handleParticipantUpdated = (updatedInfo: PeerInfo) => {
      setPeers((prev) => {
        const next = new Map(prev);
        next.set(updatedInfo.socketId, updatedInfo);
        return next;
      });
    };

    const handlePeerLeft = ({ socketId }: { socketId: string }) => {
      setPeers((prev) => {
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

    socket.on("webrtc:all-peers", handleAllPeers);
    socket.on("webrtc:peer-joined", handlePeerJoined);
    socket.on("webrtc:signal", handleSignal);
    socket.on("webrtc:participant-updated", handleParticipantUpdated);
    socket.on("webrtc:peer-left", handlePeerLeft);

    return () => {
      socket.off("webrtc:all-peers", handleAllPeers);
      socket.off("webrtc:peer-joined", handlePeerJoined);
      socket.off("webrtc:signal", handleSignal);
      socket.off("webrtc:participant-updated", handleParticipantUpdated);
      socket.off("webrtc:peer-left", handlePeerLeft);
    };
  }, [socket, inCall]);

  return (
    <div className="clay-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-400" />
          <span className="text-xs font-semibold text-white">
            Voice & Video (VC)
          </span>
          <span className="clay-pill px-2 py-0.5 text-[11px] text-zinc-400">
            {peers.size + (inCall ? 1 : 0)} connected
          </span>
        </div>

        {inCall ? (
          <button
            onClick={leaveVoice}
            className="clay-pill px-3 py-1.5 text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            Leave
          </button>
        ) : (
          <button
            onClick={joinVoice}
            className="clay-btn-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            Join VC
          </button>
        )}
      </div>

      {/* Grid */}
      {inCall ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {/* Local User Card */}
            <div className="relative aspect-video rounded-2xl bg-clay-sunken overflow-hidden flex flex-col items-center justify-center p-2 shadow-inner border border-white/5">
              {isVideoOn || isScreenSharing ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-9 h-9 rounded-full bg-brand-500/20 text-brand-400 font-bold flex items-center justify-center text-xs">
                    {currentUser.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-zinc-300">
                    @{currentUser.username} (You)
                  </span>
                </div>
              )}

              {/* Status Icons Overlay */}
              <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[11px] text-zinc-400 z-10">
                <span className="truncate">@{currentUser.username}</span>
                <div className="flex items-center gap-1">
                  {isMuted && <MicOff className="w-3 h-3 text-red-400" />}
                  {isScreenSharing && <MonitorUp className="w-3 h-3 text-cyan-400" />}
                </div>
              </div>
            </div>

            {/* Remote Peer Cards */}
            {Array.from(peers.values()).map((peer) => (
              <div
                key={peer.socketId}
                className="relative aspect-video rounded-2xl bg-clay-sunken overflow-hidden flex flex-col items-center justify-center p-2 shadow-inner border border-white/5"
              >
                <video
                  ref={(el) => {
                    if (el) remoteVideoRefs.current.set(peer.socketId, el);
                  }}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover rounded-xl ${
                    peer.isVideoOn || peer.isScreenSharing ? "block" : "hidden"
                  }`}
                />

                {!peer.isVideoOn && !peer.isScreenSharing && (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-9 h-9 rounded-full bg-clay-elevated text-zinc-200 font-semibold flex items-center justify-center text-xs">
                      {peer.user.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-zinc-300">
                      @{peer.user.username}
                    </span>
                  </div>
                )}

                <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[11px] text-zinc-400 z-10">
                  <span className="truncate">@{peer.user.username}</span>
                  <div className="flex items-center gap-1">
                    {peer.isMuted && <MicOff className="w-3 h-3 text-red-400" />}
                    {peer.isScreenSharing && (
                      <MonitorUp className="w-3 h-3 text-cyan-400" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Call Controls Bar */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={toggleMute}
              className={`p-3 rounded-2xl transition-all ${
                isMuted
                  ? "clay-card bg-red-950/40 text-red-400"
                  : "clay-btn-secondary"
              }`}
              title={isMuted ? "Unmute Mic" : "Mute Mic"}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleCamera}
              className={`p-3 rounded-2xl transition-all ${
                isVideoOn
                  ? "clay-btn-primary"
                  : "clay-btn-secondary"
              }`}
              title={isVideoOn ? "Turn Off Camera" : "Turn On Camera"}
            >
              {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-2xl transition-all ${
                isScreenSharing
                  ? "clay-btn-primary"
                  : "clay-btn-secondary"
              }`}
              title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
            >
              <MonitorUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-3 text-xs text-zinc-500">
          Click "Join VC" to activate voice & video with room members.
        </div>
      )}
    </div>
  );
}
