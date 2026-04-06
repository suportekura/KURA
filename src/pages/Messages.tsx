import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, MessageCircle, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { fadeUpVariants, staggerContainer, staggerItem, DURATION, EASE } from '@/lib/animations';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';

interface ConversationListItem {
  id: string;
  product_id: string | null;
  product_title: string | null;
  product_image: string | null;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar: string | null;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
}

export default function Messages() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch all conversations where user is participant
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('*, products(title, images)')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (convError) throw convError;

      // Process each conversation
      const processedConvs = await Promise.all(
        (convData || []).map(async (conv) => {
          const otherUserId = conv.participant_1 === user.id
            ? conv.participant_2
            : conv.participant_1;

          // Get other user's profile
          const { data: profileData } = await supabase
            .from('public_profiles')
            .select('display_name, avatar_url')
            .eq('user_id', otherUserId)
            .maybeSingle();

          // Get last message
          const { data: lastMsgData } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Count unread messages
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .is('read_at', null);

          return {
            id: conv.id,
            product_id: conv.product_id,
            product_title: conv.products?.title || null,
            product_image: conv.products?.images?.[0] || null,
            other_user_id: otherUserId,
            other_user_name: profileData?.display_name || 'Usuário',
            other_user_avatar: profileData?.avatar_url,
            last_message: lastMsgData?.content || null,
            last_message_at: lastMsgData?.created_at || conv.created_at,
            unread_count: unreadCount || 0,
          };
        })
      );

      setConversations(processedConvs);
    } catch (err) {
      console.error('[Messages] Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: fetchConversations,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (!user) return;

    fetchConversations();

    // Subscribe to new messages for real-time updates
    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Refetch conversations when new message arrives
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading, navigate, fetchConversations]);

  if (authLoading || loading) {
    return (
      <AppLayout showHeader={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout showHeader={false}>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="px-4 py-6 space-y-6"
      >
        {/* Header */}
        <motion.div variants={fadeUpVariants} transition={{ duration: DURATION.fast, ease: EASE.out }} className="space-y-1">
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Mensagens
          </h1>
          <p className="text-muted-foreground">
            Suas conversas com compradores e vendedores
          </p>
        </motion.div>

        {/* Conversations List */}
        {conversations.length > 0 ? (
          <div className="space-y-2">
            {conversations.map((conversation, index) => (
              <motion.button
                variants={staggerItem}
                custom={index}
                key={conversation.id}
                onClick={() => navigate(`/chat/${conversation.id}`)}
                className="w-full card-premium p-4 flex items-start gap-4 hover:shadow-elevated transition-all"
              >
                {/* Product Image */}
                <div className="relative flex-shrink-0">
                  {conversation.product_image ? (
                    <img
                      src={conversation.product_image}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  {conversation.other_user_avatar ? (
                    <img
                      src={conversation.other_user_avatar}
                      alt=""
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-card object-cover"
                    />
                  ) : (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-card bg-muted flex items-center justify-center">
                      <User className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium text-foreground truncate">
                      {conversation.other_user_name}
                    </h3>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(conversation.last_message_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  {conversation.product_title && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conversation.product_title}
                    </p>
                  )}
                  <p className="text-sm text-foreground/80 truncate mt-1">
                    {conversation.last_message || 'Nenhuma mensagem ainda'}
                  </p>
                </div>

                {/* Unread Badge */}
                {conversation.unread_count > 0 && (
                  <Badge className="flex-shrink-0 w-5 h-5 rounded-full p-0 flex items-center justify-center text-xs">
                    {conversation.unread_count}
                  </Badge>
                )}
              </motion.button>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">
              Nenhuma conversa ainda
            </h3>
            <p className="text-muted-foreground text-sm">
              Quando você iniciar uma conversa com um vendedor ou comprador, ela aparecerá aqui
            </p>
          </Card>
        )}
      </motion.div>
    </AppLayout>
  );
}
