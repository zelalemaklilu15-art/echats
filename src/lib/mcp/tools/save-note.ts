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
  name: "save_note",
  title: "Save a note to Saved Messages",
  description: "Save a personal text note to the user's Echat Saved Messages.",
  inputSchema: {
    note: z.string().trim().min(1).max(4000).describe("The note text to save."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ note }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await sb(ctx)
      .from("saved_messages")
      .insert({ user_id: ctx.getUserId(), note })
      .select("id, note, saved_at")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Saved: ${data.id}` }],
      structuredContent: { saved: data },
    };
  },
});
