import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_messages",
  title: "List chat messages",
  description: "List the most recent messages in a 1-to-1 Echat chat by chat_id (RLS enforces access).",
  inputSchema: {
    chat_id: z.string().uuid().describe("The Echat chat id (UUID)."),
    limit: z.number().int().min(1).max(200).optional().describe("Max messages (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ chat_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await sb(ctx)
      .from("messages")
      .select("id, chat_id, sender_id, receiver_id, content, message_type, created_at, status")
      .eq("chat_id", chat_id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []).slice().reverse();
    return {
      content: [{ type: "text", text: JSON.stringify(rows) }],
      structuredContent: { messages: rows },
    };
  },
});
