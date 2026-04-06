import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, UserMinus, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface FollowingUser {
  id: string;
  following_id: string;
  display_name: string | null;
  avatar_url: string | null;
  shop_logo_url: string | null;
}

export default function Following() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchFollowing = async () => {
      setLoading(true);
      
      // Get users that the current user follows
      const { data: followingData, error } = await supabase
        .from('followers')
        .select('id, following_id')
        .eq('follower_id', user.id)
        .order('created_at', { ascending: false });

      if (error || !followingData) {
        setLoading(false);
        return;
      }

      if (followingData.length === 0) {
        setFollowing([]);
        setLoading(false);
        return;
      }

      // Get profiles for each followed user
      const followingIds = followingData.map(f => f.following_id);
      
      const { data: profilesData } = await supabase
        .from('public_profiles')
        .select('user_id, display_name, avatar_url, shop_logo_url')
        .in('user_id', followingIds);

      const profilesMap = new Map(
        profilesData?.map(p => [p.user_id, p]) || []
      );

      const enrichedFollowing = followingData.map(f => ({
        id: f.id,
        following_id: f.following_id,
        display_name: profilesMap.get(f.following_id)?.display_name || null,
        avatar_url: profilesMap.get(f.following_id)?.avatar_url || null,
        shop_logo_url: profilesMap.get(f.following_id)?.shop_logo_url || null,
      }));

      setFollowing(enrichedFollowing);
      setLoading(false);
    };

    fetchFollowing();
  }, [user]);

  const handleUnfollow = async (followRecord: FollowingUser) => {
    if (!user) return;

    setUnfollowingId(followRecord.following_id);
    
    try {
      const { error } = await supabase
        .from('followers')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', followRecord.following_id);

      if (error) throw error;

      setFollowing(prev => prev.filter(f => f.following_id !== followRecord.following_id));
      
      toast({
        title: 'Deixou de seguir',
        description: `Você deixou de seguir ${followRecord.display_name || 'este usuário'}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Não foi possível deixar de seguir. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUnfollowingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Seguindo</h1>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-4 w-32 flex-1" />
                <Skeleton className="h-9 w-24" />
              </div>
            ))}
          </div>
        ) : following.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
              <UserPlus className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">
              Você ainda não segue ninguém
            </h2>
            <p className="text-muted-foreground text-sm max-w-xs mb-6">
              Explore vendedores e siga para acompanhar suas novidades
            </p>
            <Button
              variant="outline"
              onClick={() => navigate('/')}
            >
              Explorar vendedores
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {following.map((followedUser) => {
              const initials = followedUser.display_name?.slice(0, 2).toUpperCase() || 'US';
              const isUnfollowing = unfollowingId === followedUser.following_id;
              
              return (
                <div
                  key={followedUser.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <Link to={`/seller/${followedUser.following_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={followedUser.shop_logo_url || followedUser.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-medium text-foreground truncate">
                      {followedUser.display_name || 'Usuário'}
                    </p>
                  </Link>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnfollow(followedUser)}
                    disabled={isUnfollowing}
                    className="shrink-0"
                  >
                    {isUnfollowing ? (
                      <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <UserMinus className="h-4 w-4 mr-1" />
                        Deixar de seguir
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
