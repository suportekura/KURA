import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

import type { VerificationLevel } from '@/components/reputation';

export interface SellerProfile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  shop_logo_url: string | null;
  city: string | null;
  created_at: string;
  followers_count: number;
  sold_count: number;
  shop_description: string | null;
  business_hours: Record<string, { open: string; close: string; closed: boolean }> | null;
  social_instagram: string | null;
  social_website: string | null;
  // Reputation fields
  seller_reviews_count: number;
  seller_reviews_sum: number;
  buyer_reviews_count: number;
  buyer_reviews_sum: number;
  // Verification
  verification_level: VerificationLevel;
}

export interface SellerStats {
  activeProducts: number;
  soldProducts: number;
  reviewsCount: number;
  followersCount: number;
  // Weighted rating data
  sellerReviewsCount: number;
  sellerReviewsSum: number;
}

export function useSellerProfile(sellerId: string | undefined) {
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch seller profile with reputation fields
      const { data: profileData, error: profileError } = await supabase
        .from('public_profiles')
        .select('user_id, username, display_name, avatar_url, banner_url, shop_logo_url, city, created_at, followers_count, sold_count, shop_description, business_hours, social_instagram, social_website, seller_reviews_count, seller_reviews_sum, buyer_reviews_count, buyer_reviews_sum')
        .eq('user_id', sellerId)
        .single();

      if (profileError) throw profileError;

      // Fetch active subscription to determine verification level
      const now = new Date().toISOString();
      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select('plan_type, expires_at')
        .eq('user_id', sellerId)
        .neq('plan_type', 'free')
        .or(`expires_at.is.null,expires_at.gte.${now}`)
        .maybeSingle();

      let verificationLevel: VerificationLevel = null;
      if (subData?.plan_type === 'loja') verificationLevel = 'loja';
      else if (subData?.plan_type === 'plus') verificationLevel = 'plus';

      setProfile({
        ...profileData,
        business_hours: profileData.business_hours as SellerProfile['business_hours'],
        seller_reviews_count: profileData.seller_reviews_count || 0,
        seller_reviews_sum: profileData.seller_reviews_sum || 0,
        buyer_reviews_count: profileData.buyer_reviews_count || 0,
        buyer_reviews_sum: profileData.buyer_reviews_sum || 0,
        verification_level: verificationLevel,
      });

      // Fetch stats (active + reserved products count)
      const { count: activeCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
        .in('status', ['active', 'reserved']);

      setStats({
        activeProducts: activeCount || 0,
        soldProducts: profileData.sold_count || 0,
        reviewsCount: profileData.seller_reviews_count || 0,
        followersCount: profileData.followers_count || 0,
        sellerReviewsCount: profileData.seller_reviews_count || 0,
        sellerReviewsSum: profileData.seller_reviews_sum || 0,
      });
    } catch (err) {
      console.error('[useSellerProfile] Error:', err);
      setError('Erro ao carregar perfil do vendedor');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, stats, loading, error, refetch: fetchProfile };
}

export function useFollowSeller(sellerId: string | undefined) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !sellerId) {
      setLoading(false);
      return;
    }

    const checkFollowing = async () => {
      const { data } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', sellerId)
        .maybeSingle();

      setIsFollowing(!!data);
      setLoading(false);
    };

    checkFollowing();
  }, [user, sellerId]);

  const toggleFollow = async () => {
    if (!user || !sellerId) return;

    setLoading(true);
    try {
      if (isFollowing) {
        await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', sellerId);
        setIsFollowing(false);
      } else {
        await supabase
          .from('followers')
          .insert({ follower_id: user.id, following_id: sellerId });
        setIsFollowing(true);
      }
    } catch (err) {
      console.error('[useFollowSeller] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return { isFollowing, loading, toggleFollow };
}

export function useSellerProducts(sellerId: string | undefined, filters?: {
  search?: string;
  category?: string;
  brand?: string;
  size?: string;
  priceMin?: number;
  priceMax?: number;
}) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    let query = supabase
      .from('products')
      .select('*')
      .eq('seller_id', sellerId)
      .in('status', ['active', 'reserved'])
      .order('created_at', { ascending: false });

    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`);
    }
    if (filters?.category) {
      query = query.eq('category', filters.category as any);
    }
    if (filters?.brand) {
      query = query.ilike('brand', `%${filters.brand}%`);
    }
    if (filters?.size) {
      query = query.eq('size', filters.size);
    }
    if (filters?.priceMin) {
      query = query.gte('price', filters.priceMin);
    }
    if (filters?.priceMax) {
      query = query.lte('price', filters.priceMax);
    }

    const { data, error } = await query;

    if (!error && data) {
      setProducts(data);
    }
    setLoading(false);
  }, [sellerId, filters?.search, filters?.category, filters?.brand, filters?.size, filters?.priceMin, filters?.priceMax]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, refetch: fetchProducts };
}
