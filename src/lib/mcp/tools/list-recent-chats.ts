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
  name: "list_recent_chats",
  title: "List recent chats",
  description: "List the signed-in user's most recent 1-to-1 Echat chats, ordered by last message time.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max number of chats to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await sb(ctx)
      .from("chats")
      .select("id, participant_1, participant_2, last_message, last_message_time, last_sender_id")
      .order("last_message_time", { ascending: false, nullsFirst: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { chats: data ?? [] },
    };
  },
});
