// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send, Trash2, Sparkles, Square, Image, Plus, MessageSquare, X, Mic, MicOff, Share2, Settings, ThumbsUp, ThumbsDown, Flag, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  streamAIResponse,
  generateImage,
  isImageRequest,
  loadConversations,
  createConversation,
  updateConversationTitle,
  deleteConversation,
  loadMessages,
  saveMessage,
  STARTER_SUGGESTIONS,
  submitMessageFeedback,
  loadFeedback,
  loadSettings,
  saveSettings,
  AI_MODELS,
  type AIMessage,
  type AIConversation,
  type AISettings,
  type FeedbackRating,
} from "@/lib/aiAssistantService";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import ShareImageDialog from "@/components/chat/ShareImageDialog";

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    const parts: React.ReactNode[] = [];
    let rest = line;
    let key = 0;
    while (rest.length > 0) {
      const boldMatch = rest.match(/^\*\*(.+?)\*\*/);
      const italicMatch = rest.match(/^_(.+?)_/);
      const codeMatch = rest.match(/^`(.+?)`/);
      if (boldMatch) {
        parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
        rest = rest.slice(boldMatch[0].length);
      } else if (italicMatch) {
        parts.push(<em key={key++}>{italicMatch[1]}</em>);
        rest = rest.slice(italicMatch[0].length);
      } else if (codeMatch) {
        parts.push(<code key={key++} className="px-1 py-0.5 rounded text-xs bg-white/10 font-mono">{codeMatch[1]}</code>);
        rest = rest.slice(codeMatch[0].length);
      } else {
        const nextSpecial = rest.search(/\*\*|_[^_]|`/);
        if (nextSpecial > 0) { parts.push(rest.slice(0, nextSpecial)); rest = rest.slice(nextSpecial); }
        else { parts.push(rest); rest = ""; }
      }
    }
    if (line.startsWith("• ") || line.startsWith("- ")) {
      result.push(<div key={i} className="flex gap-1.5"><span className="mt-1 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 opacity-60" /><span>{parts.slice(1)}</span></div>);
    } else {
      result.push(<span key={i}>{parts}</span>);
    }
    if (i < lines.length - 1) result.push(<br key={`br_${i}`} />);
  });
  return result;
}

const AIAssistant = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<AISettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, FeedbackRating>>({});
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);
  const abortCtrlRef = useRef<AbortController | null>(null);

  const { isListening, startListening, stopListening, isSupported: voiceSupported } = useVoiceInput({
    onResult: (text) => setInput(prev => prev ? `${prev} ${text}` : text),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUserId(data.session.user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadConversations().then(setConversations);
  }, [userId]);

  useEffect(() => {
    if (!activeConvId) { setMessages([]); setFeedback({}); return; }
    loadMessages(activeConvId).then(async (msgs) => {
      setMessages(msgs);
      if (userId) {
        const ids = msgs.filter(m => m.role === "assistant").map(m => m.id);
        setFeedback(await loadFeedback(userId, ids));
      }
    });
  }, [activeConvId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming, isGeneratingImage]);

  const startNewChat = useCallback(async () => {
    setActiveConvId(null);
    setMessages([]);
    setShowSidebar(false);
  }, []);

  const selectConversation = useCallback((conv: AIConversation) => {
    setActiveConvId(conv.id);
    setShowSidebar(false);
  }, []);

  const handleDeleteConv = useCallback(async (convId: string) => {
    await deleteConversation(convId);
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConvId === convId) { setActiveConvId(null); setMessages([]); }
  }, [activeConvId]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isStreaming || isGeneratingImage) return;
    setInput("");
    abortRef.current = false;

    let convId = activeConvId;
    if (!convId && userId) {
      const title = msg.slice(0, 50);
      convId = await createConversation(userId, title);
      if (convId) {
        setActiveConvId(convId);
        setConversations(prev => [{ id: convId!, title, last_message_at: new Date().toISOString(), created_at: new Date().toISOString() }, ...prev]);
      }
    }

    const userMsg: AIMessage = { id: `u_${Date.now()}`, role: "user", content: msg, timestamp: Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    if (convId) saveMessage(convId, userMsg);

    if (isImageRequest(msg)) {
      setIsGeneratingImage(true);
      try {
        const result = await generateImage(msg);
        const aiMsg: AIMessage = { id: `a_${Date.now()}`, role: "assistant", content: result.text || "Here's your generated image! 🎨", image_url: result.imageUrl, timestamp: Date.now() };
        setMessages(prev => [...prev, aiMsg]);
        if (convId) saveMessage(convId, aiMsg);
      } catch (err: any) {
        toast.error(err.message || "Image generation failed");
        const errMsg: AIMessage = { id: `a_${Date.now()}`, role: "assistant", content: `❌ ${err.message}`, timestamp: Date.now() };
        setMessages(prev => [...prev, errMsg]);
        if (convId) saveMessage(convId, errMsg);
      } finally {
        setIsGeneratingImage(false);
      }
      return;
    }

    setIsStreaming(true);
    let assistantContent = "";
    const assistantId = `a_${Date.now()}`;
    abortCtrlRef.current = new AbortController();

    await streamAIResponse({
      messages: updated,
      settings,
      signal: abortCtrlRef.current.signal,
      onDelta: (chunk) => {
        if (abortRef.current) return;
        assistantContent += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.id === assistantId) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
          }
          return [...prev, { id: assistantId, role: "assistant", content: assistantContent, timestamp: Date.now() }];
        });
      },
      onDone: () => {
        setIsStreaming(false);
        if (convId && assistantContent) {
          saveMessage(convId, { id: assistantId, role: "assistant", content: assistantContent, timestamp: Date.now() });
          updateConversationTitle(convId, messages[0]?.content?.slice(0, 50) || "Chat");
        }
      },
      onError: (error) => {
        setIsStreaming(false);
        toast.error(error);
        const errMsg: AIMessage = { id: assistantId, role: "assistant", content: `❌ ${error}`, timestamp: Date.now() };
        setMessages(prev => [...prev, errMsg]);
        if (convId) saveMessage(convId, errMsg);
      },
    });
  }, [input, messages, isStreaming, isGeneratingImage, activeConvId, userId, settings]);

  const handleStop = () => {
    abortRef.current = true;
    abortCtrlRef.current?.abort();
    setIsStreaming(false);
  };

  const updateSettings = useCallback((patch: Partial<AISettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleClearMemory = useCallback(() => {
    setMessages([]);
    setActiveConvId(null);
    setFeedback({});
    toast.success("የውይይት ማስታወሻ ጸድቷል");
  }, []);

  const handleFeedback = useCallback(async (messageId: string, rating: FeedbackRating, reason?: string) => {
    if (!userId) { toast.error("Sign in required"); return; }
    try {
      await submitMessageFeedback({ userId, conversationId: activeConvId, messageId, rating, reason });
      setFeedback(prev => ({ ...prev, [messageId]: rating }));
      toast.success(rating === "like" ? "አመሰግናለሁ! 👍" : rating === "dislike" ? "ግብረመልስ ተመዝግቧል" : "ሪፖርት ተልኳል");
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  }, [userId, activeConvId]);

  const copyMessage = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  }, []);

  const isBusy = isStreaming || isGeneratingImage;
  const isEmpty = messages.length === 0;

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowSidebar(false)} />
            <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", damping: 25 }} className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border z-50 flex flex-col">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-bold text-base">Chat History</h2>
                <button onClick={() => setShowSidebar(false)} className="p-1 rounded-full hover:bg-muted/60"><X className="h-5 w-5" /></button>
              </div>
              <button onClick={startNewChat} className="mx-3 mt-3 px-4 py-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors flex items-center gap-2 text-sm font-medium">
                <Plus className="h-4 w-4" /> New Chat
              </button>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {conversations.map(conv => (
                  <div key={conv.id} className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors text-sm", activeConvId === conv.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50")}>
                    <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-60" />
                    <span className="flex-1 truncate" onClick={() => selectConversation(conv)}>{conv.title}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteConv(conv.id); }} className="p-0.5 rounded hover:bg-destructive/20"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>
                ))}
                {conversations.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No conversations yet</p>}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-top pt-4 pb-3 border-b border-border/50 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors flex-shrink-0"><ArrowLeft className="h-5 w-5" /></button>
        <button onClick={() => setShowSidebar(true)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors flex-shrink-0"><MessageSquare className="h-4.5 w-4.5" /></button>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-primary" style={{ background: "var(--gradient-primary)" }}><Sparkles className="h-5 w-5" /></div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
          </div>
          <div>
            <p className="font-bold text-[15px]">Echat AI</p>
            <p className="text-xs text-emerald-500 font-medium">
              {isStreaming ? "Thinking…" : isGeneratingImage ? "Generating image…" : isListening ? "Listening…" : "Powered by AI"}
            </p>
          </div>
        </div>
        <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors" aria-label="AI settings"><Settings className="h-4.5 w-4.5 text-muted-foreground" /></button>
        <button onClick={startNewChat} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors" aria-label="New chat"><Plus className="h-4.5 w-4.5 text-muted-foreground" /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-20">
            <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2.5 }} className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-primary" style={{ background: "var(--gradient-primary)" }}>
              <Sparkles className="h-9 w-9" />
            </motion.div>
            <div className="text-center">
              <p className="text-xl font-bold mb-1">Echat AI</p>
              <p className="text-sm text-muted-foreground max-w-xs">Ask me anything — text, translation, code, or generate images!</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {STARTER_SUGGESTIONS.map((s, i) => (
                <motion.button key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} onClick={() => handleSend(s)} className="px-4 py-3 rounded-2xl border border-border/60 bg-card hover:bg-muted/50 transition-colors text-sm text-left font-medium">
                  {s}
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0 mr-2 mt-1" style={{ background: "var(--gradient-primary)" }}><Sparkles className="h-3.5 w-3.5" /></div>
                  )}
                  <div className="flex flex-col gap-1 max-w-[80%]">
                    <div className={cn("px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap", msg.role === "user" ? "text-white rounded-br-sm" : "bg-card border border-border/50 text-foreground rounded-bl-sm")} style={msg.role === "user" ? { background: "var(--gradient-primary)" } : undefined}>
                      {renderMarkdown(msg.content)}
                      {msg.image_url && (
                        <div className="mt-2 relative group">
                          <img src={msg.image_url} alt="Generated" className="rounded-xl max-w-full max-h-80 object-contain border border-border/30" />
                          <button
                            onClick={() => setShareImageUrl(msg.image_url!)}
                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {msg.role === "assistant" && msg.content && !msg.content.startsWith("❌") && !(isStreaming && messages[messages.length - 1]?.id === msg.id) && (
                      <div className="flex items-center gap-1 px-1 -mt-0.5">
                        <button onClick={() => copyMessage(msg.id, msg.content)} className="p-1.5 rounded-full hover:bg-muted/60 text-muted-foreground" aria-label="Copy">
                          {copiedId === msg.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => handleFeedback(msg.id, "like")} className={cn("p-1.5 rounded-full hover:bg-muted/60", feedback[msg.id] === "like" ? "text-emerald-500" : "text-muted-foreground")} aria-label="Like">
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleFeedback(msg.id, "dislike")} className={cn("p-1.5 rounded-full hover:bg-muted/60", feedback[msg.id] === "dislike" ? "text-amber-500" : "text-muted-foreground")} aria-label="Dislike">
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { setReportTarget(msg.id); setReportReason(""); }} className={cn("p-1.5 rounded-full hover:bg-muted/60", feedback[msg.id] === "report" ? "text-destructive" : "text-muted-foreground")} aria-label="Report">
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {(isStreaming && messages[messages.length - 1]?.role !== "assistant") && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: "var(--gradient-primary)" }}><Sparkles className="h-3.5 w-3.5" /></div>
                <div className="bg-card border border-border/50 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1">
                  {[0, 1, 2].map(i => (<motion.div key={i} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }} className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />))}
                </div>
              </motion.div>
            )}

            {isGeneratingImage && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: "var(--gradient-primary)" }}><Image className="h-3.5 w-3.5" /></div>
                <div className="bg-card border border-border/50 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                  <span className="text-xs text-muted-foreground">Generating image…</span>
                </div>
              </motion.div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-border/50 pb-safe-bottom">
        {!isEmpty && !isBusy && (
          <div className="flex gap-2 mb-2 overflow-x-auto scrollbar-hide pb-1">
            {STARTER_SUGGESTIONS.slice(0, 3).map((s, i) => (
              <button key={i} onClick={() => handleSend(s)} className="px-3 py-1.5 rounded-full border border-border/60 bg-card text-xs font-medium whitespace-nowrap hover:bg-muted/50 transition-colors flex-shrink-0">{s}</button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          {voiceSupported && (
            <motion.div whileTap={{ scale: 0.9 }}>
              <Button
                size="icon"
                variant={isListening ? "destructive" : "ghost"}
                onClick={isListening ? stopListening : startListening}
                disabled={isBusy}
                className={cn("rounded-full flex-shrink-0", isListening && "animate-pulse")}
              >
                {isListening ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
              </Button>
            </motion.div>
          )}
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={isListening ? "Listening…" : "Ask anything or 'Generate image of…'"}
            className="flex-1 rounded-full bg-muted border-0"
            disabled={isBusy}
          />
          <motion.div whileTap={{ scale: 0.9 }}>
            {isStreaming ? (
              <Button size="icon" onClick={handleStop} className="rounded-full bg-destructive text-destructive-foreground"><Square className="h-4 w-4" /></Button>
            ) : (
              <Button size="icon" onClick={() => handleSend()} disabled={!input.trim() || isBusy} className="rounded-full text-white" style={{ background: "var(--gradient-primary)" }}><Send className="h-4.5 w-4.5" /></Button>
            )}
          </motion.div>
        </div>
      </div>

      {/* Share Image Dialog */}
      <ShareImageDialog open={!!shareImageUrl} onClose={() => setShareImageUrl(null)} imageUrl={shareImageUrl || ""} />
    </div>
  );
};

export default AIAssistant;
