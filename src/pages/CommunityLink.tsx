import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const CommunityLink = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.rpc("resolve_community_username" as never, { p_username: (username ?? "").toLowerCase() } as never).then(({ data }) => {
      if (!alive) return;
      const r = data as { kind?: string; id?: string } | null;
      if (r?.kind === "channel" && r.id) navigate(`/channel/${encodeURIComponent(r.id)}`, { replace: true });
      else if (r?.kind === "group" && r.id) navigate(`/group/${r.id}`, { replace: true });
      else setMissing(true);
    });
    return () => { alive = false; };
  }, [username, navigate]);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-background">
      {missing ? (<>
        <p className="text-lg font-semibold">@{username} was not found</p>
        <p className="text-sm text-muted-foreground">This channel or group doesn't exist or is private.</p>
        <Button onClick={() => navigate("/chats")}>Go back</Button>
      </>) : <p className="text-muted-foreground">Opening @{username}…</p>}
    </div>
  );
};
export default CommunityLink;
