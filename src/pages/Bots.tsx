import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  getBots,
  getMyBots,
  createBot,
  type Bot as BotType,
  type BotCommand,
} from "@/lib/botService";
import { toast } from "sonner";
import { motion } from "framer-motion";

const Bots = () => {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [botName, setBotName] = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [botDescription, setBotDescription] = useState("");
  const [commands, setCommands] = useState<{ command: string; response: string }[]>([]);
  const [newCommand, setNewCommand] = useState("");
  const [newResponse, setNewResponse] = useState("");
  const [version, setVersion] = useState(0);

  const allBots = getBots();
  const myBots = userId ? getMyBots(userId) : [];
  const availableBots = allBots.filter((b) => b.createdBy !== userId);

  const filterBots = (bots: BotType[]) => {
    if (!searchQuery.trim()) return bots;
    const q = searchQuery.toLowerCase();
    return bots.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.username.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
    );
  };

  const filteredMy = filterBots(myBots);
  const filteredAvailable = filterBots(availableBots);
  const isEmpty = filteredMy.length === 0 && filteredAvailable.length === 0;

  const handleAddCommand = () => {
    if (!newCommand.trim()) return;
    const cmd = newCommand.trim().startsWith("/")
      ? newCommand.trim()
      : `/${newCommand.trim()}`;
    if (commands.some((c) => c.command === cmd)) {
      toast.error("Command already exists");
      return;
    }
    setCommands([...commands, { command: cmd, response: newResponse.trim() }]);
    setNewCommand("");
    setNewResponse("");
  };

  const handleRemoveCommand = (idx: number) => {
    setCommands(commands.filter((_, i) => i !== idx));
  };

  const handleCreate = () => {
    if (!botName.trim()) {
      toast.error("Bot name is required");
      return;
    }
    if (!botUsername.trim()) {
      toast.error("Username is required");
      return;
    }
    if (!userId) return;

    const botCommands: BotCommand[] = commands.map((c) => ({
      command: c.command,
      description: c.command.slice(1),
      response: c.response,
    }));

    createBot(botName.trim(), botUsername.trim(), botDescription.trim(), userId, botCommands);
    toast.success("Bot created");
    setBotName("");
    setBotUsername("");
    setBotDescription("");
    setCommands([]);
    setDialogOpen(false);
    setVersion((v) => v + 1);
  };

  const renderBotCard = (bot: BotType, index: number) => (
    <motion.div
      key={bot.id}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      onClick={() => navigate(`/bot/${bot.id}`)}
      className="flex items-center gap-3 p-3 rounded-md cursor-pointer hover-elevate active-elevate-2"
      data-testid={`card-bot-${bot.id}`}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: bot.avatarColor }}
      >
        <Bot className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground truncate">
          {bot.name}
        </h3>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          @{bot.username}
        </p>
        {bot.description && (
          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
            {bot.description}
          </p>
        )}
      </div>
      <div className={cn(
        "w-2 h-2 rounded-full shrink-0",
        bot.isActive ? "bg-green-500" : "bg-muted-foreground/30"
      )} />
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background pb-nav" data-testid="page-bots">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border p-4 z-50"
      >
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-foreground">Bots</h1>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setDialogOpen(true)}
            data-testid="button-create-bot"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bots..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-bots"
          />
        </div>
      </motion.div>

      <div className="p-4 space-y-6">
        {isEmpty && !searchQuery && (
          <div className="flex flex-col items-center justify-center pt-24 gap-4 text-muted-foreground">
            <Bot className="h-16 w-16 opacity-30" />
            <p className="text-base font-medium" data-testid="text-empty-bots">
              No bots yet
            </p>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(true)}
              data-testid="button-create-bot-empty"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Bot
            </Button>
          </div>
        )}

        {isEmpty && searchQuery && (
          <div className="flex flex-col items-center justify-center pt-24 gap-3 text-muted-foreground">
            <Search className="h-12 w-12 opacity-30" />
            <p className="text-sm">No bots match your search</p>
          </div>
        )}

        {filteredMy.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              My Bots
            </h2>
            <div className="space-y-1">
              {filteredMy.map((b, i) => renderBotCard(b, i))}
            </div>
          </div>
        )}

        {filteredAvailable.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Available Bots
            </h2>
            <div className="space-y-1">
              {filteredAvailable.map((b, i) => renderBotCard(b, i))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Bot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="bot-name">Name</Label>
              <Input
                id="bot-name"
                placeholder="My Bot"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                data-testid="input-bot-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bot-username">Username</Label>
              <Input
                id="bot-username"
                placeholder="mybot"
                value={botUsername}
                onChange={(e) => setBotUsername(e.target.value)}
                data-testid="input-bot-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bot-desc">Description</Label>
              <Input
                id="bot-desc"
                placeholder="What does this bot do?"
                value={botDescription}
                onChange={(e) => setBotDescription(e.target.value)}
                data-testid="input-bot-description"
              />
            </div>

            <div className="space-y-3">
              <Label>Commands</Label>
              {commands.length > 0 && (
                <div className="space-y-2">
                  {commands.map((cmd, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm"
                    >
                      <span className="font-mono text-xs font-medium text-primary">
                        {cmd.command}
                      </span>
                      <span className="flex-1 text-xs text-muted-foreground truncate">
                        {cmd.response || "(no response)"}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveCommand(idx)}
                        data-testid={`button-remove-command-${idx}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="/command"
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                  className="flex-1"
                  data-testid="input-command-name"
                />
                <Input
                  placeholder="Response text"
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  className="flex-1"
                  data-testid="input-command-response"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleAddCommand}
                  data-testid="button-add-command"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="button-cancel-create-bot"
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} data-testid="button-confirm-create-bot">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Bots;
