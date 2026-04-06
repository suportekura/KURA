import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Offer {
  id: string;
  conversation_id: string;
  product_id: string;
  sender_id: string;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired';
  parent_offer_id: string | null;
  expires_at: string;
  created_at: string;
  responded_at: string | null;
}

export function useOffers(conversationId: string | undefined) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch offers
  useEffect(() => {
    if (!conversationId) return;
    if (!user) return;

    const fetchOffers = async () => {
      try {
        const { data, error } = await supabase
          .from('offers')
          .select('*')
          .eq('conversation_id', conversationId)
          .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setOffers((data as Offer[]) || []);
      } catch (err) {
        console.error('[useOffers] Error fetching:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOffers();
  }, [conversationId, user?.id]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`offers:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'offers',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOffer = payload.new as Offer;
            setOffers((prev) => {
              if (prev.some((o) => o.id === newOffer.id)) return prev;
              return [...prev, newOffer];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedOffer = payload.new as Offer;
            setOffers((prev) =>
              prev.map((o) => (o.id === updatedOffer.id ? updatedOffer : o))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const createOffer = useCallback(
    async (productId: string, amount: number, parentOfferId?: string) => {
      if (!user || !conversationId) return null;

      try {
        const { data, error } = await supabase
          .from('offers')
          .insert({
            conversation_id: conversationId,
            product_id: productId,
            sender_id: user.id,
            amount,
            parent_offer_id: parentOfferId || null,
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: parentOfferId ? 'Contra-oferta enviada' : 'Oferta enviada',
          description: `Valor: R$ ${amount.toFixed(2)}`,
        });

        return data as Offer;
      } catch (err) {
        console.error('[useOffers] Error creating offer:', err);
        toast({
          title: 'Erro ao enviar oferta',
          variant: 'destructive',
        });
        return null;
      }
    },
    [user, conversationId, toast]
  );

  const respondToOffer = useCallback(
    async (offerId: string, accept: boolean) => {
      if (!user) return false;

      try {
        const { error } = await supabase
          .from('offers')
          .update({
            status: accept ? 'accepted' : 'rejected',
            responded_at: new Date().toISOString(),
          })
          .eq('id', offerId)
          .neq('sender_id', user.id);

        if (error) throw error;

        toast({
          title: accept ? 'Oferta aceita!' : 'Oferta recusada',
        });

        return true;
      } catch (err) {
        console.error('[useOffers] Error responding:', err);
        toast({
          title: 'Erro ao responder oferta',
          variant: 'destructive',
        });
        return false;
      }
    },
    [user, toast]
  );

  const getLatestPendingOffer = useCallback(() => {
    const now = new Date().toISOString();
    return offers.find((o) => o.status === 'pending' && o.expires_at > now) || null;
  }, [offers]);

  const hasAcceptedOffer = useCallback(() => {
    return offers.some((o) => o.status === 'accepted');
  }, [offers]);

  return {
    offers,
    loading,
    createOffer,
    respondToOffer,
    getLatestPendingOffer,
    hasAcceptedOffer,
  };
}
