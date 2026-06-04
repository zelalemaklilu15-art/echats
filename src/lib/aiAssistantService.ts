import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const IMAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-image`;

export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string | null;
  timestamp: number;
}

export interface AIConversation {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
}

// ---- DB persistence ----

export async function loadConversations(): Promise<AIConversation[]> {
  const { data } = await supabase
    .from("ai_conversations" as any)
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(50);
  return (data as any[]) || [];
}

export async function createConversation(userId: string, title: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("ai_conversations" as any)
    .insert({ user_id: userId, title } as any)
    .select("id")
    .single();
  if (error) { console.error("Create conv error:", error); return null; }
  return (data as any)?.id || null;
}

export async function updateConversationTitle(convId: string, title: string) {
  await supabase
    .from("ai_conversations" as any)
    .update({ title, last_message_at: new Date().toISOString() } as any)
    .eq("id", convId);
}

export async function deleteConversation(convId: string) {
  await supabase.from("ai_conversations" as any).delete().eq("id", convId);
}

export async function loadMessages(convId: string): Promise<AIMessage[]> {
  const { data } = await supabase
    .from("ai_messages" as any)
    .select("*")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true });
  return ((data as any[]) || []).map((m: any) => ({
    id: m.id,
    role: m.role,
    content: m.content || "",
    image_url: m.image_url,
    timestamp: new Date(m.created_at).getTime(),
  }));
}

export async function saveMessage(convId: string, msg: AIMessage) {
  await supabase.from("ai_messages" as any).insert({
    conversation_id: convId,
    role: msg.role,
    content: msg.content || null,
    image_url: msg.image_url || null,
  } as any);
}

// ---- Streaming chat ----

export type AISettings = {
  model?: string;
  systemAppend?: string;
  memoryEnabled?: boolean;
};

export async function streamAIResponse({
  messages,
  onDelta,
  onDone,
  onError,
  settings,
  signal,
}: {
  messages: AIMessage[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  settings?: AISettings;
  signal?: AbortSignal;
}) {
  try {
    const memoryEnabled = settings?.memoryEnabled !== false;
    const slice = memoryEnabled ? messages.slice(-40) : messages.slice(-1);
    const apiMessages = slice.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: apiMessages,
        model: settings?.model,
        systemAppend: settings?.systemAppend,
      }),
      signal,
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      onError(errData.error || `Error ${resp.status}`);
      return;
    }

    if (!resp.body) { onError("No response body"); return; }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { streamDone = true; break; }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (err) {
    console.error("Stream error:", err);
    onError(err instanceof Error ? err.message : "Connection failed");
  }
}

// ---- Image generation ----

export async function generateImage(prompt: string): Promise<{ text: string; imageUrl: string | null }> {
  const resp = await fetch(IMAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.error || `Error ${resp.status}`);
  }

  return resp.json();
}

// ---- Helpers ----

export function isImageRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(generate|create|draw|make|design|paint|sketch|imagine)\b.*\b(image|picture|photo|illustration|art|drawing|logo|icon|poster|banner)\b/i.test(lower)
    || /\b(image|picture|photo|illustration)\b.*\b(of|for|about|showing)\b/i.test(lower)
    || /^(draw|paint|sketch|imagine)\b/i.test(lower)
    || /ምስል|ሥዕል|ስዕል/i.test(lower);
}

export const STARTER_SUGGESTIONS = [
  "What can you do?",
  "Translate hello to Amharic",
  "Write a Python sort function",
  "Generate an image of a sunset",
];
