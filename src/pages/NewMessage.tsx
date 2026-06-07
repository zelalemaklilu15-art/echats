// @ts-nocheck
import { isUserOnline } from "@/lib/formatLastSeen";
import { ArrowLeft, Search, Users, UserPlus, Hash, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useChatList, useProfile } from "@/hooks/useChatStore";
import { chatStore, PublicProfile } from "@/lib/chatStore";
import { searchUsers, findOrCreateChat } from "@/lib/supabaseService";
import { toast } from "sonner";

// Contact item component
interface ContactItemProps {
  userId: string;
  onClick: (userId: string) => void;
}

const ContactItem = ({ userId, onClick }: ContactItemProps) => {
  const { profile, loading } = useProfile(userId);
  
  if (loading || !profile) {
    return (
      <div className="flex items-center space-x-3 p-3">
        <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse w-32" />
          <div className="h-3 bg-muted rounded animate-pulse w-24" />
        </div>
      </div>
    );
  }
  
  return (
    <div
      onClick={() => onClick(userId)}
      className="flex items-center space-x-3 p-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-smooth"
    >
      <ChatAvatar
        name={profile.name || profile.username}
        src={profile.avatar_url || undefined}
        status={isUserOnline(profile.last_seen, profile.is_online) ? "online" : "offline"}
        size="md"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">
            {profile.name || profile.username}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          @{profile.username}
        </p>
      </div>
    </div>
  );
};

const NewMessage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  
  // Get existing contacts from chats
  const { chats, loading } = useChatList();
  const currentUserId = chatStore.getCurrentUserId();
  
  // Extract unique contact IDs
  const contactIds = Array.from(new Set(
    chats.map(chat => chatStore.getOtherUserId(chat))
  )).filter(id => id && id !== currentUserId);

  // Search users
  useEffect(() => {
    const search = async () => {
      const query = searchQuery.trim();
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }
      
      setSearching(true);
      try {
        const results = await searchUsers(query);
        setSearchResults(results.filter(u => u.id !== currentUserId));
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setSearching(false);
      }
    };
    
    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, currentUserId]);

  const handleBack = () => {
    navigate("/chats");
  };

  const handleNewGroup = () => {
    navigate("/new-group");
  };

  const handleNewContact = () => {
    // Just focus the search - searching IS adding contacts
    toast.info("Search for users by username to start a chat");
  };

  const handleNewChannel = () => {
    navigate("/channels");
  };

  const handleContactClick = async (userId: string) => {
    if (!currentUserId) return;
    
    const chatId = await findOrCreateChat(currentUserId, userId);
    if (chatId) {
      navigate(`/chat/${chatId}`);
    } else {
      toast.error("Failed to open chat");
    }
  };

  const handleSearchResultClick = async (user: PublicProfile) => {
    if (!currentUserId) return;
    
    const chatId = await findOrCreateChat(currentUserId, user.id);
    if (chatId) {
      navigate(`/chat/${chatId}`);
      toast.success(`Chat with @${user.username} opened`);
    } else {
      toast.error("Failed to start chat");
    }
  };

  const showSearchResults = searchQuery.trim().length >= 2;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border p-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">New Message</h1>
          </div>
        </div>
        
        {/* Search */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted border-0 rounded-full"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
          )}
        </div>
      </div>

      {/* Action Options */}
      {!showSearchResults && (
        <div className="space-y-1 p-2">
          <Button
            variant="ghost"
            className="w-full justify-start h-14 px-4 hover:bg-muted/50"
            onClick={handleNewGroup}
          >
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-base font-medium">New Group</span>
            </div>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start h-14 px-4 hover:bg-muted/50"
            onClick={handleNewContact}
          >
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-base font-medium">Find Users</span>
            </div>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start h-14 px-4 hover:bg-muted/50"
            onClick={handleNewChannel}
          >
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Hash className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-base font-medium">New Channel</span>
            </div>
          </Button>
        </div>
      )}

      {/* Search Results */}
      {showSearchResults && (
        <div className="p-4">
          <h3 className="text-sm text-muted-foreground font-medium mb-3">Search Results</h3>
          {searching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No users found for "{searchQuery}"
            </p>
          ) : (
            <div className="space-y-1">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleSearchResultClick(user)}
                  className="flex items-center space-x-3 p-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-smooth"
                >
                  <ChatAvatar
                    name={user.name || user.username}
                    src={user.avatar_url || undefined}
                    status={isUserOnline(user.last_seen, user.is_online) ? "online" : "offline"}
                    size="md"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground">
                      {user.name || user.username}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      @{user.username}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contacts Section */}
      {!showSearchResults && (
        <div className="px-4 py-2">
          <h3 className="text-sm text-muted-foreground font-medium mb-3">
            Recent Contacts ({contactIds.length})
          </h3>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : contactIds.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Search for users to start a conversation
            </p>
          ) : (
            <div className="space-y-1">
              {contactIds.slice(0, 10).map((userId) => (
                <ContactItem
                  key={userId}
                  userId={userId}
                  onClick={handleContactClick}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NewMessage;
