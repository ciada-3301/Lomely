"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSocket } from "@/lib/socket";
import {
  MessageSquare,
  Search,
  Send,
  ArrowLeft,
  Circle,
} from "lucide-react";
import Link from "next/link";

interface Conversation {
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    status: string;
  };
  lastMessage: string;
  lastMessageAt: string | Date;
  unreadCount: number;
}

interface MessageItem {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string | Date;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activePartner, setActivePartner] = useState<Conversation["user"] | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [typingAlert, setTypingAlert] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/messages/users");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (!userSearch.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/messages/users?q=${encodeURIComponent(userSearch)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users || []);
        }
      } catch (err) {
        console.error("Search users error:", err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [userSearch]);

  const loadMessages = async (targetUserId: string) => {
    try {
      const res = await fetch(`/api/messages/direct?userId=${targetUserId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setActivePartner(data.targetUser);
      }
    } catch (err) {
      console.error("Load DM error:", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    socketRef.current = socket;

    socket.emit("user:init", { userId: user.id });

    const handleReceivedDM = (newMsg: MessageItem) => {
      if (activePartner && (newMsg.senderId === activePartner.id || newMsg.receiverId === activePartner.id)) {
        setMessages((prev) => [...prev, newMsg]);
      }
      fetchConversations();
    };

    const handleTyping = ({ senderUsername }: { senderUsername: string }) => {
      if (activePartner && activePartner.username === senderUsername) {
        setTypingAlert(`${senderUsername} is typing...`);
        setTimeout(() => setTypingAlert(null), 3000);
      }
    };

    socket.on("dm:received", handleReceivedDM);
    socket.on("dm:user_typing", handleTyping);

    return () => {
      socket.off("dm:received", handleReceivedDM);
      socket.off("dm:user_typing", handleTyping);
    };
  }, [user, activePartner]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activePartner || !user) return;

    const content = input.trim();
    setInput("");

    try {
      const res = await fetch("/api/messages/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: activePartner.id, content }),
      });

      if (res.ok) {
        const data = await res.json();
        const sentMsg = data.message;
        setMessages((prev) => [...prev, sentMsg]);

        socketRef.current?.emit("dm:send", {
          receiverId: activePartner.id,
          message: sentMsg,
        });

        fetchConversations();
      }
    } catch (err) {
      console.error("Failed to send DM:", err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (activePartner && user) {
      socketRef.current?.emit("dm:typing", {
        receiverId: activePartner.id,
        senderUsername: user.username,
      });
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="max-w-md p-8 clay-card-elevated space-y-4">
          <div className="w-12 h-12 rounded-2xl clay-pill flex items-center justify-center mx-auto text-brand-400">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Direct Messages</h2>
          <p className="text-xs text-zinc-400">
            Sign in to start conversations with registered users.
          </p>
          <Link
            href="/login"
            className="clay-btn-primary inline-block px-4 py-2 text-xs"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-6">
      <div className="h-[720px] max-h-[82vh] clay-card-elevated overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Left Sidebar: Conversations & User Search */}
        <div
          className={`md:col-span-5 lg:col-span-4 border-r border-white/5 flex flex-col ${
            activePartner ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Header & User Search */}
          <div className="p-4 space-y-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-brand-400" />
                Messages
              </h2>
            </div>

            <div className="relative">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search @username..."
                className="w-full pl-8 pr-3 py-1.5 text-xs clay-input"
              />
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
            </div>

            {/* Live Search dropdown */}
            {searchResults.length > 0 && (
              <div className="rounded-xl clay-card p-1.5 space-y-1">
                <p className="text-[10px] text-zinc-500 px-2 py-0.5">Users</p>
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      loadMessages(u.id);
                      setUserSearch("");
                      setSearchResults([]);
                    }}
                    className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-clay-highlight text-left transition-colors text-xs"
                  >
                    <div className="w-6 h-6 rounded-full bg-clay-elevated flex items-center justify-center text-[10px] text-zinc-200 font-semibold">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-zinc-200">@{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="text-center py-12 p-4 text-xs text-zinc-500">
                No active conversations yet. Search a username above to start chatting.
              </div>
            ) : (
              conversations.map((c) => {
                const isSelected = activePartner?.id === c.user.id;
                return (
                  <button
                    key={c.user.id}
                    onClick={() => loadMessages(c.user.id)}
                    className={`w-full p-3 rounded-2xl flex items-start gap-3 text-left transition-all ${
                      isSelected
                        ? "clay-card bg-clay-highlight/60 text-white"
                        : "hover:bg-white/5 text-zinc-300"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-clay-elevated flex items-center justify-center text-xs text-zinc-200 font-semibold">
                        {c.user.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
                    </div>

                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-200 truncate">
                          @{c.user.username}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(c.lastMessageAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{c.lastMessage}</p>
                    </div>

                    {c.unreadCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-brand-500 text-black text-[10px] font-bold flex items-center justify-center shrink-0">
                        {c.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center / Right: Chat Stream */}
        <div
          className={`md:col-span-7 lg:col-span-8 flex flex-col ${
            activePartner ? "flex" : "hidden md:flex"
          }`}
        >
          {activePartner ? (
            <>
              {/* Header */}
              <div className="p-3.5 border-b border-white/5 flex items-center justify-between bg-clay-base/40">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActivePartner(null)}
                    className="md:hidden p-1 text-zinc-400 hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="w-8 h-8 rounded-full bg-clay-elevated flex items-center justify-center text-xs text-zinc-200 font-semibold">
                    {activePartner.username.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-white">
                      @{activePartner.username}
                    </h3>
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                      <Circle className="w-1.5 h-1.5 fill-current" />
                      Active
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages Thread */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-clay-sunken/40">
                {messages.length === 0 ? (
                  <div className="text-center py-20 text-xs text-zinc-500">
                    Start of conversation with @{activePartner.username}.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.senderId === user.id;
                    const time = new Date(m.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words ${
                            isMe
                              ? "clay-btn-primary font-medium"
                              : "clay-card text-zinc-200"
                          }`}
                        >
                          {m.content}
                        </div>
                        <span className="text-[9px] text-zinc-500 mt-1 px-1">
                          {time}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Typing indicator alert */}
              {typingAlert && (
                <div className="px-4 py-1 text-[10px] text-brand-400 bg-clay-base/50">
                  {typingAlert}
                </div>
              )}

              {/* Input Box */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-white/5 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder={`Message @${activePartner.username}...`}
                  className="flex-1 px-3.5 py-2 text-xs clay-input"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="clay-btn-primary p-2 disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 space-y-3">
              <div className="w-14 h-14 rounded-2xl clay-pill flex items-center justify-center mx-auto text-zinc-500">
                <MessageSquare className="w-6 h-6 stroke-1" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-300">No conversation selected</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                Choose a conversation from the left or search a username to start chatting.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
