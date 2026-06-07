// Image generation goes through the secure `ai-image` edge function
// (which holds any provider keys server-side). The previous client-side
// VITE_OPENAI_API_KEY path was removed because Vite inlines `VITE_*`
// env vars into the public bundle, which would leak the key.
import { supabase } from "@/integrations/supabase/client";

export async function generateImage(prompt: string): Promise<string> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const { data, error } = await supabase.functions.invoke("ai-image", {
      headers: { Authorization: `Bearer ${token}` },
      body: { prompt },
    });
    if (!error && (data?.imageUrl || data?.url)) return (data.imageUrl || data.url) as string;
  } catch {
    // fall through to free fallback
  }
  // Free public fallback (no key needed)
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`;
}
