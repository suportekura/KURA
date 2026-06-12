import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Total de mensagens de chat não lidas em todas as conversas do usuário.
 *
 * A contagem não precisa filtrar por participante: o RLS de `messages` já
 * restringe o SELECT às conversas em que o usuário participa — basta excluir
 * as mensagens enviadas por ele mesmo.
 *
 * Atualiza em tempo real: INSERT cobre mensagens novas e UPDATE cobre o
 * preenchimento de read_at quando o chat é aberto. O realtime do Supabase
 * respeita RLS, então só chegam eventos das conversas do próprio usuário.
 */
export function useUnreadMessagesCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-messages-count', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_id', user!.id)
        .is('read_at', null);

      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`unread-messages-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new.sender_id === user.id) return;
          queryClient.invalidateQueries({ queryKey: ['unread-messages-count', user.id] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unread-messages-count', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return { unreadCount };
}
