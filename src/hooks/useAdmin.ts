import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdminUser {
  user_id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
  profile_completed: boolean;
  plan_type: string;
  plan_expires_at: string | null;
  roles: string[] | null;
  suspended_at: string | null;
  suspension_reason: string | null;
}

export interface AdminUserDetails {
  profile: {
    user_id: string;
    display_name: string | null;
    full_name: string | null;
    avatar_url: string | null;
    city: string | null;
    suspended_at: string | null;
    suspension_reason: string | null;
    phone: string | null;
    created_at: string;
    updated_at: string;
    profile_completed: boolean;
    user_type: string | null;
    seller_reviews_count: number;
    buyer_reviews_count: number;
    followers_count: number;
    sold_count: number;
  };
  subscription: {
    id: string;
    plan_type: string;
    expires_at: string | null;
    started_at: string;
  } | null;
  roles: string[] | null;
  boosts: {
    id: string;
    total_boosts: number;
    used_boosts: number;
  } | null;
  products_count: number;
  orders_as_buyer: number;
  orders_as_seller: number;
}

export interface AdminLog {
  id: string;
  admin_user_id: string;
  admin_name: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DashboardStats {
  total_users: number;
  active_users_30d: number;
  free_users: number;
  pro_users: number;
  moderation_queue: number;
  new_users_7d: number;
  total_products: number;
  total_orders: number;
}

export interface AnalyticsData {
  daily_signups: { day: string; count: number }[];
  daily_orders: { day: string; count: number; revenue: number }[];
  daily_products: { day: string; count: number }[];
  plans_distribution: { free: number; pro: number };
  top_categories: { name: string; total: number }[];
}

export function useAdmin() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getDashboardStats = useCallback(async (): Promise<DashboardStats | null> => {
    const { data, error } = await supabase.rpc('admin_get_dashboard_stats');
    if (error) {
      console.error('[useAdmin] Stats error:', error);
      return null;
    }
    return data as unknown as DashboardStats;
  }, []);

  const getAnalytics = useCallback(async (days: number = 30): Promise<AnalyticsData | null> => {
    const { data, error } = await supabase.rpc('admin_get_analytics', { p_days: days });
    if (error) {
      console.error('[useAdmin] Analytics error:', error);
      return null;
    }
    return data as unknown as AnalyticsData;
  }, []);

  const listUsers = useCallback(async (params: {
    search?: string;
    planFilter?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: AdminUser[]; total: number } | null> => {
    const { data, error } = await supabase.rpc('admin_list_users', {
      p_search: params.search || null,
      p_plan_filter: params.planFilter || null,
      p_limit: params.limit || 20,
      p_offset: params.offset || 0,
    });
    if (error) {
      console.error('[useAdmin] List users error:', error);
      return null;
    }
    const result = data as unknown as { users: AdminUser[]; total: number };
    return result;
  }, []);

  const getUserDetails = useCallback(async (userId: string): Promise<AdminUserDetails | null> => {
    const { data, error } = await supabase.rpc('admin_get_user_details', {
      p_user_id: userId,
    });
    if (error) {
      console.error('[useAdmin] User details error:', error);
      return null;
    }
    return data as unknown as AdminUserDetails;
  }, []);

  const updateSubscription = useCallback(async (params: {
    targetUserId: string;
    planType: string;
    expiresAt?: string | null;
    note?: string;
  }): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_update_subscription', {
        p_target_user_id: params.targetUserId,
        p_plan_type: params.planType,
        p_expires_at: params.expiresAt || null,
        p_note: params.note || null,
      });
      if (error) throw error;
      const result = data as unknown as { success: boolean };
      if (result.success) {
        toast({ title: 'Assinatura atualizada com sucesso' });
      }
      return result.success;
    } catch (err) {
      console.error('[useAdmin] Update subscription error:', err);
      toast({ title: 'Erro ao atualizar assinatura', variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateBoosts = useCallback(async (params: {
    targetUserId: string;
    totalBoosts: number;
    note?: string;
  }): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_update_boosts', {
        p_target_user_id: params.targetUserId,
        p_total_boosts: params.totalBoosts,
        p_note: params.note || null,
      });
      if (error) throw error;
      const result = data as unknown as { success: boolean };
      if (result.success) {
        toast({ title: 'Boosts atualizados com sucesso' });
      }
      return result.success;
    } catch (err) {
      console.error('[useAdmin] Update boosts error:', err);
      toast({ title: 'Erro ao atualizar boosts', variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const manageRole = useCallback(async (params: {
    targetUserId: string;
    role: 'admin' | 'moderator' | 'user';
    action: 'add' | 'remove';
  }): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_manage_role', {
        p_target_user_id: params.targetUserId,
        p_role: params.role,
        p_action: params.action,
      });
      if (error) throw error;
      const result = data as unknown as { success: boolean; error?: string };
      if (!result.success) {
        toast({ title: result.error || 'Erro ao gerenciar papel', variant: 'destructive' });
        return false;
      }
      toast({ title: `Papel ${params.action === 'add' ? 'adicionado' : 'removido'} com sucesso` });
      return true;
    } catch (err) {
      console.error('[useAdmin] Manage role error:', err);
      toast({ title: 'Erro ao gerenciar papel', variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const suspendUser = useCallback(async (params: {
    targetUserId: string;
    suspend: boolean;
    reason?: string;
  }): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_suspend_user', {
        p_target_user_id: params.targetUserId,
        p_suspend: params.suspend,
        p_reason: params.reason || null,
      });
      if (error) throw error;
      const result = data as unknown as { success: boolean; error?: string };
      if (!result.success) {
        toast({ title: result.error || 'Erro ao gerenciar suspensão', variant: 'destructive' });
        return false;
      }
      toast({ title: params.suspend ? 'Usuário suspenso' : 'Suspensão removida' });
      return true;
    } catch (err) {
      console.error('[useAdmin] Suspend user error:', err);
      toast({ title: 'Erro ao gerenciar suspensão', variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getLogs = useCallback(async (params: {
    actionFilter?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AdminLog[]; total: number } | null> => {
    const { data, error } = await supabase.rpc('admin_get_logs', {
      p_action_filter: params.actionFilter || null,
      p_limit: params.limit || 50,
      p_offset: params.offset || 0,
    });
    if (error) {
      console.error('[useAdmin] Get logs error:', error);
      return null;
    }
    return data as unknown as { logs: AdminLog[]; total: number };
  }, []);

  return {
    loading,
    getDashboardStats,
    getAnalytics,
    listUsers,
    getUserDetails,
    updateSubscription,
    updateBoosts,
    manageRole,
    suspendUser,
    getLogs,
  };
}
