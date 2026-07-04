import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listRecentChatsTool from "./tools/list-recent-chats";
import listMessagesTool from "./tools/list-messages";
import searchUsersTool from "./tools/search-users";
import saveNoteTool from "./tools/save-note";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "echat-mcp",
  title: "Echat",
  version: "0.1.0",
  instructions:
    "Tools for the Echat super-app. Read the signed-in user's chats and messages, search Echat users, and save notes to Saved Messages. All actions run as the authenticated Echat user; RLS is enforced.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listRecentChatsTool, listMessagesTool, searchUsersTool, saveNoteTool],
});
