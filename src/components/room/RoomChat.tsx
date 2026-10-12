"use client";

import React, { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { Send, MessageSquare } from "lucide-react";

interface Message {
  id?: string;
  content: string;
  createdAt: string | Date;
  sender: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
}

interface RoomChatProps {
  roomCode: string;
  currentUser: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
  socket: Socket | null;
}

export default function RoomChat({ roomCode, currentUser, socket }: RoomChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomCode}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    };
    fetchHistory();
  }, [roomCode]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on("room:message:received", handleNewMessage);

    return () => {
      socket.off("room:message:received", handleNewMessage);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const content = input.trim();
    setInput("");

    const newMsg: Message = {
      content,
      createdAt: new Date().toISOString(),
      sender: {
        id: currentUser.id,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
      },
    };

    socket?.emit("room:message:send", {
      roomCode,
      message: newMsg,
    });

    try {
      await fetch(`/api/rooms/${roomCode}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    } catch (err) {
      console.error("Failed to persist message:", err);
    }
  };

  return (
    <div className="clay-card flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-semibold text-white">
            In-Room Chat
          </span>
        </div>
        <span className="clay-pill px-2 py-0.5 text-[10px] text-zinc-400">
          Live
        </span>
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3 min-h-[220px] max-h-[460px]">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-xs text-zinc-500">
            No messages yet. Say hello to the room.
          </div>
        ) : (
          messages.map((m, index) => {
            const isMe = m.sender.id === currentUser.id;
            const time = new Date(m.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={index} className="flex items-start gap-2.5 text-xs">
                <div className="w-6 h-6 rounded-full bg-clay-elevated flex items-center justify-center text-[10px] text-zinc-200 font-semibold shrink-0">
                  {m.sender.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`font-semibold text-xs ${
                        isMe ? "text-brand-400" : "text-zinc-300"
                      }`}
                    >
                      @{m.sender.username}
                    </span>
                    <span className="text-[10px] text-zinc-500">{time}</span>
                  </div>
                  <p className="text-zinc-200 mt-0.5 leading-relaxed break-words">
                    {m.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-white/5 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message room..."
          className="flex-1 px-3.5 py-2 text-xs clay-input"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="clay-btn-primary p-2 disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
