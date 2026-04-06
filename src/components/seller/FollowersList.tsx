import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

interface Follower {
  id: string;
  follower_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface FollowersListProps {
  sellerId: string;
}

export function FollowersList({ sellerId }: FollowersListProps) {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowers = async () => {
      setLoading(true);
      
      // First get followers
      const { data: followersData, error } = await supabase
        .from('followers')
        .select('id, follower_id, created_at')
        .eq('following_id', sellerId)
        .order('created_at', { ascending: false });

      if (error || !followersData) {
        setLoading(false);
        return;
      }

      // Then get profiles for each follower
      const followerIds = followersData.map(f => f.follower_id);
      
      if (followerIds.length === 0) {
        setFollowers([]);
        setLoading(false);
        return;
      }

      const { data: profilesData } = await supabase
        .from('public_profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', followerIds);

      const profilesMap = new Map(
        profilesData?.map(p => [p.user_id, p]) || []
      );

      const enrichedFollowers = followersData.map(f => ({
        id: f.id,
        follower_id: f.follower_id,
        created_at: f.created_at,
        display_name: profilesMap.get(f.follower_id)?.display_name || null,
        avatar_url: profilesMap.get(f.follower_id)?.avatar_url || null,
      }));

      setFollowers(enrichedFollowers);
      setLoading(false);
    };

    fetchFollowers();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (followers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhum seguidor ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 py-4">
      {followers.map((follower) => {
        const initials = follower.display_name?.slice(0, 2).toUpperCase() || 'US';
        
        return (
          <Link
            key={follower.id}
            to={`/seller/${follower.follower_id}`}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
          >
            <Avatar className="h-12 w-12">
              <AvatarImage src={follower.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {follower.display_name || 'Usuário'}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
