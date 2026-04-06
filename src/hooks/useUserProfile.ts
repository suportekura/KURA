import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PFProfileData {
  full_name: string;
  display_name: string;
  age: number;
}

export interface PJProfileData {
  company_name: string;
  display_name: string;
}

export interface PaymentProfileData {
  pix_key_type: string;
}

export interface AddressData {
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

export interface UserProfileData {
  userType: 'PF' | 'PJ' | null;
  phone: string | null;
  username: string | null;
  username_updated_at: string | null;
  pfProfile: PFProfileData | null;
  pjProfile: PJProfileData | null;
  paymentProfile: PaymentProfileData | null;
  address: AddressData | null;
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch main profile
      const { data: mainProfile, error: mainError } = await supabase
        .from('profiles')
        .select('user_type, phone, username, username_updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (mainError) throw mainError;

      const userType = mainProfile?.user_type as 'PF' | 'PJ' | null;

      // Fetch PF or PJ profile based on user type
      let pfProfile: PFProfileData | null = null;
      let pjProfile: PJProfileData | null = null;

      if (userType === 'PF') {
        const { data: pf, error: pfError } = await supabase
          .from('pf_profiles')
          .select('full_name, display_name, age')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (pfError) throw pfError;
        pfProfile = pf;
      } else if (userType === 'PJ') {
        const { data: pj, error: pjError } = await supabase
          .from('pj_profiles')
          .select('company_name, display_name')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (pjError) throw pjError;
        pjProfile = pj;
      }

      // Fetch payment profile
      const { data: payment, error: paymentError } = await supabase
        .from('payment_profiles')
        .select('pix_key_type')
        .eq('user_id', user.id)
        .maybeSingle();

      if (paymentError) throw paymentError;

      // Fetch address
      const { data: addressData, error: addressError } = await supabase
        .from('addresses')
        .select('street, number, complement, neighborhood, city, state, zip_code')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .maybeSingle();

      if (addressError) throw addressError;

      setProfile({
        userType,
        phone: mainProfile?.phone ?? null,
        username: mainProfile?.username ?? null,
        username_updated_at: mainProfile?.username_updated_at ?? null,
        pfProfile,
        pjProfile,
        paymentProfile: payment,
        address: addressData,
      });
    } catch (err) {
      console.error('[useUserProfile] Error fetching profile:', err);
      setError('Erro ao carregar perfil');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
}

export function useUserListingsCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    const fetchCount = async () => {
      const { count: listingsCount, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id)
        .eq('status', 'active');

      if (!error && listingsCount !== null) {
        setCount(listingsCount);
      }
    };

    fetchCount();
  }, [user]);

  return count;
}

export function useUserPurchasesCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }

    const fetchCount = async () => {
      const { count: c, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_id', user.id);

      if (!error && c !== null) setCount(c);
    };

    fetchCount();
  }, [user]);

  return count;
}

export function useUserReviewsCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }

    const fetchCount = async () => {
      const { count: c, error } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('reviewer_id', user.id);

      if (!error && c !== null) setCount(c);
    };

    fetchCount();
  }, [user]);

  return count;
}
