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
  name: "search_users",
  title: "Search Echat users",
  description: "Search Echat users by username or display name (case-insensitive). Returns public profile fields only.",
  inputSchema: {
    query: z.string().trim().min(1).max(64).describe("Username or name fragment."),
    limit: z.number().int().min(1).max(25).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const pattern = `%${query.replace(/[%_]/g, "")}%`;
    const { data, error } = await sb(ctx)
      .from("profiles")
      .select("id, username, name, avatar_url, bio, is_online")
      .or(`username.ilike.${pattern},name.ilike.${pattern}`)
      .limit(limit ?? 10);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { users: data ?? [] },
    };
  },
});
