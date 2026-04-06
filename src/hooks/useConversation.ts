import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export function useConversation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const startConversation = useCallback(async (
    sellerId: string,
    productId?: string,
    initialMessage?: string
  ) => {
    if (!user) {
      toast({
        title: 'Faça login',
        description: 'Você precisa estar logado para enviar mensagens.',
        variant: 'destructive',
      });
      navigate('/auth');
      return null;
    }

    if (user.id === sellerId) {
      toast({
        title: 'Ops!',
        description: 'Você não pode conversar consigo mesmo.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      // Check if target user is suspended
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('suspended_at')
        .eq('user_id', sellerId)
        .maybeSingle();

      if (targetProfile?.suspended_at) {
        toast({
          title: 'Usuário indisponível',
          description: 'Este usuário está suspenso e não pode receber mensagens.',
          variant: 'destructive',
        });
        return null;
      }

      // Check if conversation already exists
      let convQuery = supabase
        .from('conversations')
        .select('id')
        .or(`and(participant_1.eq.${user.id},participant_2.eq.${sellerId}),and(participant_1.eq.${sellerId},participant_2.eq.${user.id})`);
      
      if (productId) {
        convQuery = convQuery.eq('product_id', productId);
      } else {
        convQuery = convQuery.is('product_id', null);
      }

      const { data: existingConv, error: checkError } = await convQuery.maybeSingle();

      if (checkError && !checkError.message.includes('no rows')) {
        console.error('[useConversation] Check error:', checkError);
      }

      let conversationId = existingConv?.id;

      // Create new conversation if doesn't exist
      if (!conversationId) {
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            participant_1: user.id,
            participant_2: sellerId,
            product_id: productId || null,
          })
          .select('id')
          .single();

        if (createError) {
          // If unique constraint violation, try to find existing
          if (createError.code === '23505') {
            let retryQuery = supabase
              .from('conversations')
              .select('id')
              .or(`and(participant_1.eq.${user.id},participant_2.eq.${sellerId}),and(participant_1.eq.${sellerId},participant_2.eq.${user.id})`);

            if (productId) {
              retryQuery = retryQuery.eq('product_id', productId);
            } else {
              retryQuery = retryQuery.is('product_id', null);
            }

            const { data: retryConv } = await retryQuery.maybeSingle();
            
            conversationId = retryConv?.id;
          } else {
            throw createError;
          }
        } else {
          conversationId = newConv.id;
        }
      }

      // Send initial message if provided
      if (conversationId && initialMessage?.trim()) {
        await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: initialMessage.trim(),
          });
      }

      // Navigate to chat
      if (conversationId) {
        navigate(`/chat/${conversationId}`);
      }

      return conversationId;
    } catch (err) {
      console.error('[useConversation] Error:', err);
      toast({
        title: 'Erro ao iniciar conversa',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
      return null;
    }
  }, [user, navigate, toast]);

  return { startConversation };
}
