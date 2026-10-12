const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory media state per room for instant sync
const roomMediaState = new Map();
// In-memory active voice/video participants per room
const roomVoiceParticipants = new Map();
// In-memory suggested songs queue per room: Map<roomCode, Array<Suggestion>>
const roomSuggestedQueue = new Map();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
  });

  io.on("connection", (socket) => {
    // ----------------------------------------------------
    // User Personal Room for Direct Messages & Presence
    // ----------------------------------------------------
    socket.on("user:init", ({ userId }) => {
      if (!userId) return;
      socket.userId = userId;
      socket.join(`user:${userId}`);
    });

    // ----------------------------------------------------
    // Direct Messaging Real-time
    // ----------------------------------------------------
    socket.on("dm:send", ({ receiverId, message }) => {
      if (!receiverId || !message) return;
      io.to(`user:${receiverId}`).emit("dm:received", message);
    });

    socket.on("dm:typing", ({ receiverId, senderUsername }) => {
      if (!receiverId) return;
      io.to(`user:${receiverId}`).emit("dm:user_typing", { senderUsername });
    });

    // ----------------------------------------------------
    // Room Lifecycle & Media Synchronization
    // ----------------------------------------------------
    socket.on("room:join", ({ roomCode, user }) => {
      if (!roomCode || !user) return;

      socket.roomCode = roomCode;
      socket.user = user;
      socket.join(`room:${roomCode}`);

      // Send existing media state to the newly joined user
      const currentMedia = roomMediaState.get(roomCode);
      if (currentMedia) {
        socket.emit("media:sync:state", currentMedia);
      }

      // Send existing song suggestions queue
      const existingQueue = roomSuggestedQueue.get(roomCode) || [];
      socket.emit("media:suggest:queue:updated", { queue: existingQueue });

      // Notify others in room
      socket.to(`room:${roomCode}`).emit("room:user:joined", { user });

      // Send existing active voice members
      const activeVoice = roomVoiceParticipants.get(roomCode) || new Map();
      socket.emit("voice:participants:list", Array.from(activeVoice.values()));
    });

    socket.on("room:leave", ({ roomCode, user }) => {
      if (!roomCode) return;
      socket.leave(`room:${roomCode}`);
      socket.to(`room:${roomCode}`).emit("room:user:left", { user: user || socket.user });

      // Clean up voice participation
      const voiceMap = roomVoiceParticipants.get(roomCode);
      if (voiceMap && voiceMap.has(socket.id)) {
        voiceMap.delete(socket.id);
        socket.to(`room:${roomCode}`).emit("voice:user:left", { socketId: socket.id });
      }
    });

    // Media change (host plays YouTube or Audius track)
    socket.on("media:change", ({ roomCode, url, title, artist, artworkUrl, mediaType, duration }) => {
      if (!roomCode) return;
      const state = {
        url,
        title: title || "Streaming Content",
        artist: artist || null,
        artworkUrl: artworkUrl || null,
        mediaType: mediaType || (url?.includes("audius") ? "AUDIUS" : "YOUTUBE"),
        duration: Number(duration) || 0,
        state: "PLAYING",
        currentTime: 0,
        updatedAt: Date.now(),
      };
      roomMediaState.set(roomCode, state);
      io.to(`room:${roomCode}`).emit("media:sync:state", state);
    });

    // Media Play
    socket.on("media:sync:play", ({ roomCode, currentTime }) => {
      if (!roomCode) return;
      const existing = roomMediaState.get(roomCode) || {};
      const updated = {
        ...existing,
        state: "PLAYING",
        currentTime: Number(currentTime) || 0,
        updatedAt: Date.now(),
      };
      roomMediaState.set(roomCode, updated);
      socket.to(`room:${roomCode}`).emit("media:sync:play", updated);
    });

    // Media Pause
    socket.on("media:sync:pause", ({ roomCode, currentTime }) => {
      if (!roomCode) return;
      const existing = roomMediaState.get(roomCode) || {};
      const updated = {
        ...existing,
        state: "PAUSED",
        currentTime: Number(currentTime) || 0,
        updatedAt: Date.now(),
      };
      roomMediaState.set(roomCode, updated);
      socket.to(`room:${roomCode}`).emit("media:sync:pause", updated);
    });

    // Media Seek
    socket.on("media:sync:seek", ({ roomCode, seekTime }) => {
      if (!roomCode) return;
      const existing = roomMediaState.get(roomCode) || {};
      const updated = {
        ...existing,
        currentTime: Number(seekTime) || 0,
        updatedAt: Date.now(),
      };
      roomMediaState.set(roomCode, updated);
      socket.to(`room:${roomCode}`).emit("media:sync:seek", { seekTime: Number(seekTime) || 0 });
    });

    // Private Room: Roommate Pause Request
    socket.on("media:request:pause", ({ roomCode, reason, user }) => {
      if (!roomCode || !user) return;
      io.to(`room:${roomCode}`).emit("media:request:pause:alert", {
        reason: reason || "Stepping away for a moment",
        user,
        timestamp: Date.now(),
      });
    });

    // Private Room: Roommate Resume Request
    socket.on("media:request:resume", ({ roomCode, user }) => {
      if (!roomCode || !user) return;
      io.to(`room:${roomCode}`).emit("media:request:resume:alert", {
        user,
        timestamp: Date.now(),
      });
    });

    // Song Suggestions Queue
    socket.on("media:suggest:track", ({ roomCode, track, suggestedBy }) => {
      if (!roomCode || !track) return;
      if (!roomSuggestedQueue.has(roomCode)) {
        roomSuggestedQueue.set(roomCode, []);
      }
      const queue = roomSuggestedQueue.get(roomCode);
      const item = {
        id: `sug-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        track,
        suggestedBy: suggestedBy || socket.user,
        suggestedAt: Date.now(),
      };
      queue.push(item);
      if (queue.length > 30) queue.shift();
      io.to(`room:${roomCode}`).emit("media:suggest:queue:updated", {
        queue,
        lastSuggestion: item,
      });
    });

    socket.on("media:suggest:dismiss", ({ roomCode, suggestionId }) => {
      if (!roomCode) return;
      const queue = roomSuggestedQueue.get(roomCode) || [];
      const updated = queue.filter((item) => item.id !== suggestionId);
      roomSuggestedQueue.set(roomCode, updated);
      io.to(`room:${roomCode}`).emit("media:suggest:queue:updated", {
        queue: updated,
      });
    });

    // In-room live message
    socket.on("room:message:send", ({ roomCode, message }) => {
      if (!roomCode || !message) return;
      io.to(`room:${roomCode}`).emit("room:message:received", message);
    });

    // ----------------------------------------------------
    // WebRTC Signaling (Voice, Video, Screen Share)
    // ----------------------------------------------------
    socket.on("webrtc:join", ({ roomCode, user, mediaStatus }) => {
      if (!roomCode || !user) return;

      if (!roomVoiceParticipants.has(roomCode)) {
        roomVoiceParticipants.set(roomCode, new Map());
      }

      const participantInfo = {
        socketId: socket.id,
        user,
        isMuted: mediaStatus?.isMuted || false,
        isVideoOn: mediaStatus?.isVideoOn || false,
        isScreenSharing: mediaStatus?.isScreenSharing || false,
      };

      const voiceMap = roomVoiceParticipants.get(roomCode);
      // Remove any lingering previous sockets for this same user ID
      for (const [sId, p] of voiceMap.entries()) {
        if (p.user.id === user.id && sId !== socket.id) {
          voiceMap.delete(sId);
        }
      }

      voiceMap.set(socket.id, participantInfo);

      // Tell the new joiner about other people currently in the call
      const peers = Array.from(voiceMap.values()).filter(
        (p) => p.socketId !== socket.id && p.user.id !== user.id
      );
      socket.emit("webrtc:all-peers", peers);

      // Notify others in room that this user joined voice
      socket.to(`room:${roomCode}`).emit("webrtc:peer-joined", participantInfo);
    });

    socket.on("webrtc:signal", ({ targetSocketId, signalData }) => {
      if (!targetSocketId) return;
      io.to(targetSocketId).emit("webrtc:signal", {
        senderSocketId: socket.id,
        signalData,
      });
    });

    socket.on("webrtc:status-change", ({ roomCode, mediaStatus }) => {
      if (!roomCode) return;
      const voiceMap = roomVoiceParticipants.get(roomCode);
      if (voiceMap && voiceMap.has(socket.id)) {
        const item = voiceMap.get(socket.id);
        const updated = {
          ...item,
          isMuted: mediaStatus.isMuted ?? item.isMuted,
          isVideoOn: mediaStatus.isVideoOn ?? item.isVideoOn,
          isScreenSharing: mediaStatus.isScreenSharing ?? item.isScreenSharing,
        };
        voiceMap.set(socket.id, updated);
        // Broadcast ONLY to others, never to the sender themselves
        socket.to(`room:${roomCode}`).emit("webrtc:participant-updated", updated);
      }
    });

    socket.on("webrtc:leave", ({ roomCode }) => {
      if (!roomCode) return;
      const voiceMap = roomVoiceParticipants.get(roomCode);
      if (voiceMap && voiceMap.has(socket.id)) {
        voiceMap.delete(socket.id);
        io.to(`room:${roomCode}`).emit("webrtc:peer-left", { socketId: socket.id });
      }
    });

    // ----------------------------------------------------
    // Disconnect cleanup
    // ----------------------------------------------------
    socket.on("disconnect", () => {
      if (socket.roomCode) {
        const roomCode = socket.roomCode;
        socket.to(`room:${roomCode}`).emit("room:user:left", { user: socket.user });

        const voiceMap = roomVoiceParticipants.get(roomCode);
        if (voiceMap && voiceMap.has(socket.id)) {
          voiceMap.delete(socket.id);
          io.to(`room:${roomCode}`).emit("webrtc:peer-left", { socketId: socket.id });
        }
      }
    });
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Lomely Engine ready on http://${hostname}:${port}`);
  });
});
