// @ts-nocheck
import { isUserOnline } from "@/lib/formatLastSeen";
import { useState, useEffect } from "react";
import { ArrowLeft, Search, Loader2, UserPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { chatStore, PublicProfile } from "@/lib/chatStore";
import { searchUsers } from "@/lib/supabaseService";
import { 
  getGroup, 
  getGroupMembers, 
  addGroupMember, 
  isGroupAdmin,
  Group,
  GroupMember 
} from "@/lib/groupService";

const AddGroupMembers = () => {
  const [group, setGroup] = useState<Group | null>(null);
  const [existingMembers, setExistingMembers] = useState<GroupMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingMember, setAddingMember] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<PublicProfile[]>([]);
  
  const navigate = useNavigate();
  const { groupId } = useParams();

  // Load group and existing members
  useEffect(() => {
    if (!groupId) {
      navigate('/chats');
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        // Check if user is admin
        const adminStatus = await isGroupAdmin(groupId);
        if (!adminStatus) {
          toast.error("Only admins can add members");
          navigate(`/group/${groupId}`);
          return;
        }

        const [groupData, membersData] = await Promise.all([
          getGroup(groupId),
          getGroupMembers(groupId),
        ]);

        if (!groupData) {
          toast.error("Group not found");
          navigate('/chats');
          return;
        }

        setGroup(groupData);
        setExistingMembers(membersData);

        // Load contacts from existing chats
        const chats = chatStore.getChatList();
        const currentUserId = chatStore.getCurrentUserId();
        const contactProfiles: PublicProfile[] = [];

        for (const chat of chats) {
          const otherUserId = chat.participant_1 === currentUserId 
            ? chat.participant_2 
            : chat.participant_1;
          
          const profile = await chatStore.getProfile(otherUserId);
          if (profile) {
            contactProfiles.push(profile);
          }
        }

        setContacts(contactProfiles);
      } catch (error) {
        console.error("Error loading group:", error);
        toast.error("Failed to load group");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [groupId, navigate]);

  // Search for users
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results = await searchUsers(query);
      // Filter out existing members
      const existingIds = new Set(existingMembers.map(m => m.user_id));
      const filtered = results.filter(u => !existingIds.has(u.id));
      setSearchResults(filtered);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  // Add member to group
  const handleAddMember = async (userId: string) => {
    if (!groupId || addingMember) return;

    setAddingMember(userId);
    try {
      const success = await addGroupMember(groupId, userId);
      if (success) {
        toast.success("Member added successfully");
        // Update local state
        setExistingMembers(prev => [...prev, {
          id: `temp-${userId}`,
          group_id: groupId,
          user_id: userId,
          role: 'member',
          joined_at: new Date().toISOString(),
        }]);
        // Remove from search results
        setSearchResults(prev => prev.filter(u => u.id !== userId));
      } else {
        toast.error("Failed to add member");
      }
    } catch (error) {
      console.error("Error adding member:", error);
      toast.error("Failed to add member");
    } finally {
      setAddingMember(null);
    }
  };

  // Check if user is already a member
  const isMember = (userId: string) => {
    return existingMembers.some(m => m.user_id === userId);
  };

  // Filter contacts that aren't already members
  const availableContacts = contacts.filter(c => !isMember(c.id));

  // Display list (search results or available contacts)
  const displayList = searchQuery.length >= 2 ? searchResults : availableContacts;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        <p className="text-muted-foreground mb-4">Group not found</p>
        <Button onClick={() => navigate('/chats')}>Back to Chats</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border p-4 z-10">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/group/${groupId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Add Members</h1>
            <p className="text-xs text-muted-foreground">{group.name}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 bg-muted border-0 rounded-full"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
          )}
        </div>
      </div>

      {/* User List */}
      <div className="divide-y divide-border">
        {displayList.length === 0 ? (
          <div className="p-8 text-center">
            <UserPlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchQuery.length >= 2 
                ? "No users found" 
                : availableContacts.length === 0 
                  ? "All your contacts are already members"
                  : "Search for users to add"}
            </p>
          </div>
        ) : (
          displayList.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-smooth"
            >
              <div className="flex items-center space-x-3">
                <ChatAvatar
                  name={user.name || user.username}
                  src={user.avatar_url || undefined}
                  status={isUserOnline(user.last_seen, user.is_online) ? "online" : "offline"}
                  size="md"
                />
                <div>
                  <h3 className="font-medium text-foreground">
                    {user.name || user.username}
                  </h3>
                  <p className="text-sm text-muted-foreground">@{user.username}</p>
                </div>
              </div>

              {isMember(user.id) ? (
                <div className="flex items-center text-status-online">
                  <Check className="h-5 w-5 mr-1" />
                  <span className="text-sm">Added</span>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleAddMember(user.id)}
                  disabled={addingMember === user.id}
                  className="bg-primary hover:bg-primary/90"
                >
                  {addingMember === user.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Done button */}
      <div className="fixed bottom-6 left-4 right-4">
        <Button 
          className="w-full bg-gradient-primary hover:opacity-90"
          onClick={() => navigate(`/group/${groupId}`)}
        >
          Done
        </Button>
      </div>
    </div>
  );
};

export default AddGroupMembers;
