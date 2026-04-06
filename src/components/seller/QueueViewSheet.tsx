import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Clock, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface QueueUser {
  id: string;
  position: number;
  status: string;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface PromotedEntry {
  id: string;
  promotion_expires_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface QueueViewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productTitle: string;
}

export function QueueViewSheet({ open, onOpenChange, productId, productTitle }: QueueViewSheetProps) {
  const [users, setUsers] = useState<QueueUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [promotedEntry, setPromotedEntry] = useState<PromotedEntry | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !productId) return;

    const fetchQueue = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_queue')
        .select('id, position, status, created_at, user_id')
        .eq('product_id', productId)
        .eq('status', 'waiting')
        .order('position', { ascending: true });

      if (error || !data) {
        console.error('Error fetching queue:', error);
        setLoading(false);
        return;
      }

      // Fetch profiles for these users
      if (data.length > 0) {
        const userIds = data.map(d => d.user_id);
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);

        const profileMap = new Map(
          (profiles || []).map(p => [p.user_id, p])
        );

        const mapped: QueueUser[] = data.map(q => {
          const profile = profileMap.get(q.user_id);
          return {
            id: q.id,
            position: q.position,
            status: q.status,
            created_at: q.created_at,
            display_name: profile?.display_name || 'Usuário',
            avatar_url: profile?.avatar_url || null,
          };
        });

        setUsers(mapped);
      } else {
        setUsers([]);
      }
      setLoading(false);
    };

    fetchQueue();
  }, [open, productId]);

  useEffect(() => {
    if (!open || !productId) return;

    const fetchPromoted = async () => {
      const { data, error } = await supabase
        .from('product_queue')
        .select('id, promotion_expires_at, user_id')
        .eq('product_id', productId)
        .eq('status', 'promoted')
        .maybeSingle();

      if (error || !data) {
        setPromotedEntry(null);
        return;
      }

      const { data: profile } = await supabase
        .from('public_profiles')
        .select('display_name, avatar_url')
        .eq('user_id', data.user_id)
        .maybeSingle();

      setPromotedEntry({
        id: data.id,
        promotion_expires_at: data.promotion_expires_at,
        display_name: profile?.display_name || 'Usuário',
        avatar_url: profile?.avatar_url || null,
      });
    };

    fetchPromoted();
  }, [open, productId]);

  const handlePromoteNext = async () => {
    setIsPromoting(true);
    const { error } = await supabase.rpc('promote_next_in_queue', {
      p_product_id: productId,
    });
    setIsPromoting(false);

    if (error) {
      toast({ title: 'Erro ao promover usuário', variant: 'destructive' });
      return;
    }

    toast({ title: 'Próximo usuário promovido!' });

    // Inline refetch after promote
    setPromotedEntry(null);
    setUsers([]);
    setLoading(true);

    const { data: qData, error: qError } = await supabase
      .from('product_queue')
      .select('id, position, status, created_at, user_id')
      .eq('product_id', productId)
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    if (!qError) {
      if (qData && qData.length > 0) {
        const userIds = qData.map(d => d.user_id);
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);
        const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
        setUsers(qData.map(q => {
          const p = profileMap.get(q.user_id);
          return {
            id: q.id,
            position: q.position,
            status: q.status,
            created_at: q.created_at,
            display_name: p?.display_name || 'Usuário',
            avatar_url: p?.avatar_url || null,
          };
        }));
      } else {
        setUsers([]);
      }
    } else {
      console.error('Error re-fetching queue after promote:', qError);
    }
    setLoading(false);

    const { data: pData } = await supabase
      .from('product_queue')
      .select('id, promotion_expires_at, user_id')
      .eq('product_id', productId)
      .eq('status', 'promoted')
      .maybeSingle();

    if (pData) {
      const { data: pProfile } = await supabase
        .from('public_profiles')
        .select('display_name, avatar_url')
        .eq('user_id', pData.user_id)
        .maybeSingle();
      setPromotedEntry({
        id: pData.id,
        promotion_expires_at: pData.promotion_expires_at,
        display_name: pProfile?.display_name || 'Usuário',
        avatar_url: pProfile?.avatar_url || null,
      });
    } else {
      setPromotedEntry(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-primary" />
            Fila de espera
          </SheetTitle>
          <p className="text-sm text-muted-foreground truncate">{productTitle}</p>
        </SheetHeader>

        <div className="space-y-3 overflow-y-auto max-h-[50vh] pb-4">
          {/* Promoted user card */}
          {promotedEntry && (() => {
            const expiresAt = promotedEntry.promotion_expires_at
              ? new Date(promotedEntry.promotion_expires_at)
              : null;
            const minsLeft = expiresAt
              ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000))
              : 0;
            return (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
                  Promovido agora
                </p>
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={promotedEntry.avatar_url || undefined} />
                    <AvatarFallback className="text-sm font-medium">
                      {(promotedEntry.display_name || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{promotedEntry.display_name}</p>
                    <div className="flex items-center gap-1 text-xs text-emerald-600/80 dark:text-emerald-500/80">
                      <Clock className="w-3 h-3" />
                      <span>Expira em {minsLeft} min</span>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-0 text-xs">
                    Promovido
                  </Badge>
                </div>
              </div>
            );
          })()}

          {/* Promote next button — only when no one is promoted and there are waiting users */}
          {users.length > 0 && !promotedEntry && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handlePromoteNext}
              disabled={isPromoting}
            >
              <ChevronRight className="w-4 h-4 mr-2" />
              {isPromoting ? 'Promovendo...' : 'Promover próximo'}
            </Button>
          )}

          {/* Waiting list */}
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))
          ) : users.length === 0 && !promotedEntry ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum usuário na fila no momento.
            </div>
          ) : users.length > 0 ? (
            <>
              <p className="text-xs font-medium text-muted-foreground px-1">
                Aguardando ({users.length})
              </p>
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="text-sm font-medium">
                        {(user.display_name || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Badge
                      variant="secondary"
                      className="absolute -top-1 -left-1 w-5 h-5 p-0 flex items-center justify-center text-[10px] font-bold"
                    >
                      {user.position}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.display_name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>
                        Entrou {formatDistanceToNow(new Date(user.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
