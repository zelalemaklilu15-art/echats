import { useState } from "react";
import { isUserOnline } from "@/lib/formatLastSeen";
import { ArrowLeft, Users, Camera, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useChatList, useProfile } from "@/hooks/useChatStore";
import { chatStore } from "@/lib/chatStore";
import { createGroup } from "@/lib/groupService";
import { toast } from "sonner";

// Contact item for group selection
interface ContactItemProps {
  userId: string;
  selected: boolean;
  onToggle: () => void;
}

const ContactItem = ({ userId, selected, onToggle }: ContactItemProps) => {
  const { profile, loading } = useProfile(userId);
  
  if (loading || !profile) {
    return (
      <div className="flex items-center space-x-3 p-3 rounded-lg">
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
      className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-smooth"
      onClick={onToggle}
    >
      <ChatAvatar
        name={profile.name || profile.username}
        src={profile.avatar_url || undefined}
        status={isUserOnline(profile.last_seen, profile.is_online) ? "online" : "offline"}
        size="md"
      />
      
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-foreground truncate">
          {profile.name || profile.username}
        </h3>
        <p className="text-sm text-muted-foreground truncate">
          @{profile.username}
        </p>
      </div>

      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
        selected 
          ? 'bg-primary border-primary' 
          : 'border-muted-foreground/30'
      }`}>
        {selected && <Check className="h-4 w-4 text-primary-foreground" />}
      </div>
    </div>
  );
};

const NewGroup = () => {
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  
  // Get contacts from existing chats
  const { chats, loading } = useChatList();
  const currentUserId = chatStore.getCurrentUserId();
  
  // Extract unique contact IDs
  const contactIds = Array.from(new Set(
    chats.map(chat => chatStore.getOtherUserId(chat))
  )).filter(id => id && id !== currentUserId);

  const handleContactToggle = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    
    if (selectedContacts.length === 0) {
      toast.error('Please select at least one member');
      return;
    }
    
    setCreating(true);
    
    try {
      const group = await createGroup(
        groupName.trim(),
        selectedContacts,
        groupDescription.trim() || undefined
      );
      
      if (group) {
        toast.success('Group created!');
        navigate(`/group/${group.id}`);
      } else {
        toast.error('Failed to create group');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border p-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">New Group</h1>
          </div>
          <Button 
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || selectedContacts.length === 0 || creating}
            className="bg-gradient-primary hover:opacity-90"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
        </div>
      </div>

      {/* Group Info Section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-4 mb-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <Button 
              size="icon"
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-gradient-primary"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 space-y-3">
            <Input
              placeholder="Group name *"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="font-medium"
              maxLength={100}
            />
            <Textarea
              placeholder="Group description (optional)"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              className="min-h-[60px] resize-none"
              maxLength={500}
            />
          </div>
        </div>
      </div>

      {/* Selected Members Count */}
      {selectedContacts.length > 0 && (
        <div className="p-4 bg-muted/30 border-b border-border">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{selectedContacts.length} member{selectedContacts.length > 1 ? 's' : ''} selected</span>
          </div>
        </div>
      )}

      {/* Contacts List */}
      <div className="p-4">
        <h3 className="font-medium text-foreground mb-3">Add members</h3>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : contactIds.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No contacts yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Start chatting with people to add them here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {contactIds.map((userId) => (
              <ContactItem
                key={userId}
                userId={userId}
                selected={selectedContacts.includes(userId)}
                onToggle={() => handleContactToggle(userId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewGroup;
