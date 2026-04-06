import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Package, ShoppingBag } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

import { SalesTab } from '@/components/dashboard/SalesTab';
import { PurchasesTab } from '@/components/dashboard/PurchasesTab';
import { UpgradeCTA } from '@/components/dashboard/SharedComponents';
import {
  Period,
  SalesMetrics,
  PurchaseMetrics,
  PremiumMetrics,
  DailyViewPoint,
  CategorySalesPoint,
  PERIOD_OPTIONS,
  CATEGORY_LABELS,
  getDateThreshold,
  buildChartData,
} from '@/components/dashboard/types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>('30d');
  const [sellerOrders, setSellerOrders] = useState<{ status: string; total_price: number; created_at: string }[]>([]);
  const [buyerOrders, setBuyerOrders] = useState<{ status: string; total_price: number; created_at: string }[]>([]);
  const [soldProducts, setSoldProducts] = useState<{ created_at: string }[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'vendas' | 'compras'>('vendas');
  const [hasSubscription, setHasSubscription] = useState(false);
  const [premiumMetrics, setPremiumMetrics] = useState<PremiumMetrics | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);

      try {
        const [
          { data: soldProds },
          { count: activeCnt },
          { data: sOrders },
          { data: pData },
          { data: bOrders },
          { data: subData },
        ] = await Promise.all([
          supabase.from('products').select('created_at').eq('seller_id', user.id).eq('status', 'sold'),
          supabase.from('products').select('*', { count: 'exact', head: true }).eq('seller_id', user.id).eq('status', 'active').then(r => r),
          supabase.from('orders').select('status, total_price, created_at').eq('seller_id', user.id),
          supabase.from('profiles').select('seller_reviews_count, seller_reviews_sum, buyer_reviews_count, buyer_reviews_sum').eq('user_id', user.id).maybeSingle(),
          supabase.from('orders').select('status, total_price, created_at').eq('buyer_id', user.id),
          supabase.from('user_subscriptions').select('plan_type, expires_at').eq('user_id', user.id).in('plan_type', ['plus', 'loja']).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);

        setSoldProducts(soldProds || []);
        setActiveCount(activeCnt || 0);
        setSellerOrders(sOrders || []);
        setProfileData(pData);
        setBuyerOrders(bOrders || []);

        const isActive = !!(subData && subData.plan_type === 'loja' && (!subData.expires_at || new Date(subData.expires_at) > new Date()));
        setHasSubscription(isActive);

        if (isActive) {
          await fetchPremiumMetrics(user.id, activeCnt || 0, soldProds?.length || 0);
        }
      } catch (err) {
        console.error('[Dashboard] Error fetching data:', err);
        toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const fetchPremiumMetrics = async (userId: string, activeCount: number, soldCount: number) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const productIds = (await supabase.from('products').select('id').eq('seller_id', userId)).data?.map(p => p.id) || [];

    const [
      { data: allProducts },
      { data: soldOrders },
      { data: viewsWeek },
      { data: viewsMonth },
      { count: profViewsWeek },
      { count: profViewsMonth },
      { data: dailyProductViewsRaw },
      { data: dailyProfileViewsRaw },
    ] = await Promise.all([
      supabase.from('products').select('id, view_count, category, status, created_at').eq('seller_id', userId),
      supabase.from('orders').select('product_id, created_at, total_price, status').eq('seller_id', userId).in('status', ['confirmed', 'in_transit', 'delivered']),
      supabase.from('product_views').select('id, product_id').gte('viewed_at', weekAgo).in('product_id', productIds),
      supabase.from('product_views').select('id, product_id').gte('viewed_at', monthAgo).in('product_id', productIds),
      supabase.from('profile_views').select('*', { count: 'exact', head: true }).eq('profile_user_id', userId).gte('viewed_at', weekAgo),
      supabase.from('profile_views').select('*', { count: 'exact', head: true }).eq('profile_user_id', userId).gte('viewed_at', monthAgo),
      supabase.from('product_views').select('viewed_at').gte('viewed_at', monthAgo).in('product_id', productIds),
      supabase.from('profile_views').select('viewed_at').eq('profile_user_id', userId).gte('viewed_at', monthAgo),
    ]);

    const products = allProducts || [];
    const totalViews = products.reduce((sum, p) => sum + (p.view_count || 0), 0);
    const avgViews = products.length > 0 ? totalViews / products.length : 0;

    // Avg sell time
    let avgSellTime: number | null = null;
    if (soldOrders && soldOrders.length > 0 && products.length > 0) {
      const productMap = new Map(products.map(p => [p.id, new Date(p.created_at).getTime()]));
      const sellTimes: number[] = [];
      for (const order of soldOrders) {
        const productCreated = productMap.get(order.product_id);
        if (productCreated) {
          const days = (new Date(order.created_at).getTime() - productCreated) / (1000 * 60 * 60 * 24);
          if (days >= 0) sellTimes.push(days);
        }
      }
      if (sellTimes.length > 0) {
        avgSellTime = sellTimes.reduce((a, b) => a + b, 0) / sellTimes.length;
      }
    }

    // Best selling category
    const categoryCounts: Record<string, number> = {};
    products.filter(p => p.status === 'sold').forEach(p => {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    });
    const bestCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Conversion rate
    const total = soldCount + activeCount;
    const conversion = total > 0 ? (soldCount / total) * 100 : null;

    // Daily views chart data
    const dailyMap: Record<string, { productViews: number; profileViews: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { productViews: 0, profileViews: 0 };
    }
    (dailyProductViewsRaw || []).forEach(v => {
      const key = v.viewed_at.slice(0, 10);
      if (dailyMap[key]) dailyMap[key].productViews++;
    });
    (dailyProfileViewsRaw || []).forEach(v => {
      const key = v.viewed_at.slice(0, 10);
      if (dailyMap[key]) dailyMap[key].profileViews++;
    });
    const dailyViews: DailyViewPoint[] = Object.entries(dailyMap).map(([date, vals]) => ({
      date: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
      productViews: vals.productViews,
      profileViews: vals.profileViews,
    }));

    // Category sales
    const buildCategorySales = (orders: typeof soldOrders, prods: typeof products): CategorySalesPoint[] => {
      const map: Record<string, { count: number; revenue: number }> = {};
      const productCategoryMap = new Map(prods.map(p => [p.id, p.category]));
      for (const order of (orders || [])) {
        const cat = productCategoryMap.get(order.product_id) || 'outros';
        if (!map[cat]) map[cat] = { count: 0, revenue: 0 };
        map[cat].count += 1;
        map[cat].revenue += order.total_price || 0;
      }
      return Object.entries(map)
        .map(([key, val]) => ({ name: CATEGORY_LABELS[key] || key, count: val.count, revenue: val.revenue }))
        .sort((a, b) => b.revenue - a.revenue);
    };

    const allValidOrders = soldOrders || [];
    const productCategoryMap = new Map(products.map(p => [p.id, p.category]));
    const rawCategoryOrders = allValidOrders.map(o => ({
      category: productCategoryMap.get(o.product_id) || 'outros',
      status: o.status,
      revenue: o.total_price || 0,
      created_at: o.created_at,
    }));

    setPremiumMetrics({
      avgSellTimeDays: avgSellTime !== null ? Math.round(avgSellTime * 10) / 10 : null,
      avgViewsPerProduct: Math.round(avgViews * 10) / 10,
      totalViewsWeek: viewsWeek?.length || 0,
      totalViewsMonth: viewsMonth?.length || 0,
      profileViewsWeek: profViewsWeek || 0,
      profileViewsMonth: profViewsMonth || 0,
      bestSellingCategory: bestCategory,
      conversionRate: conversion !== null ? Math.round(conversion * 10) / 10 : null,
      dailyViews,
      categorySales: buildCategorySales(allValidOrders, products),
      categorySalesConfirmed: buildCategorySales(allValidOrders.filter(o => o.status === 'confirmed'), products),
      categorySalesInTransit: buildCategorySales(allValidOrders.filter(o => o.status === 'in_transit'), products),
      categorySalesDelivered: buildCategorySales(allValidOrders.filter(o => o.status === 'delivered'), products),
      rawCategoryOrders,
    });
  };

  const salesMetrics = useMemo<SalesMetrics | null>(() => {
    if (loading) return null;
    const threshold = getDateThreshold(period);
    const filteredOrders = threshold ? sellerOrders.filter(o => o.created_at >= threshold) : sellerOrders;
    const filteredSold = threshold ? soldProducts.filter(p => p.created_at >= threshold) : soldProducts;
    const revenue = filteredOrders.filter(o => ['confirmed', 'in_transit', 'delivered'].includes(o.status)).reduce((sum, o) => sum + (o.total_price || 0), 0);
    const sellerRating = profileData && profileData.seller_reviews_count > 0 ? Number(profileData.seller_reviews_sum) / profileData.seller_reviews_count : 5.0;

    return {
      totalSold: filteredSold.length,
      totalRevenue: revenue,
      activeListings: activeCount,
      avgRating: sellerRating,
      reviewsCount: profileData?.seller_reviews_count || 0,
      pendingOrders: filteredOrders.filter(o => o.status === 'pending').length,
      confirmedOrders: filteredOrders.filter(o => ['confirmed', 'in_transit'].includes(o.status)).length,
      deliveredOrders: filteredOrders.filter(o => o.status === 'delivered').length,
    };
  }, [loading, period, sellerOrders, soldProducts, profileData, activeCount]);

  const purchaseMetrics = useMemo<PurchaseMetrics | null>(() => {
    if (loading) return null;
    const threshold = getDateThreshold(period);
    const filteredOrders = threshold ? buyerOrders.filter(o => o.created_at >= threshold) : buyerOrders;
    const spent = filteredOrders.filter(o => ['confirmed', 'in_transit', 'delivered'].includes(o.status)).reduce((sum, o) => sum + (o.total_price || 0), 0);
    const buyerRating = profileData && profileData.buyer_reviews_count > 0 ? Number(profileData.buyer_reviews_sum) / profileData.buyer_reviews_count : 5.0;

    return {
      totalPurchases: filteredOrders.filter(o => o.status !== 'cancelled').length,
      totalSpent: spent,
      pendingOrders: filteredOrders.filter(o => o.status === 'pending').length,
      deliveredOrders: filteredOrders.filter(o => o.status === 'delivered').length,
      avgRating: buyerRating,
      reviewsCount: profileData?.buyer_reviews_count || 0,
    };
  }, [loading, period, buyerOrders, profileData]);

  const salesChartData = useMemo(() => buildChartData(sellerOrders, period), [sellerOrders, period]);
  const purchaseChartData = useMemo(() => buildChartData(buyerOrders, period), [buyerOrders, period]);

  return (
    <AppLayout showHeader={false}>
      <div className="px-4 py-6 space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-display text-2xl font-semibold text-foreground">Dashboard</h1>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-2xl bg-card border border-border/50 p-1">
          <button
            onClick={() => setActiveTab('vendas')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'vendas'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Package className="w-4 h-4" />
            Vendas
          </button>
          <button
            onClick={() => setActiveTab('compras')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'compras'
                ? 'bg-secondary text-secondary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Compras
          </button>
        </div>

        {/* Period Filter */}
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[140px] rounded-xl border-border/50 bg-card text-sm font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {activeTab === 'vendas' ? (
              <SalesTab
                salesMetrics={salesMetrics}
                salesChartData={salesChartData}
                hasSubscription={hasSubscription}
                premiumMetrics={premiumMetrics}
                period={period}
              />
            ) : (
              <PurchasesTab
                purchaseMetrics={purchaseMetrics}
                purchaseChartData={purchaseChartData}
              />
            )}

            {!hasSubscription && <UpgradeCTA />}
          </>
        )}
      </div>
    </AppLayout>
  );
}
