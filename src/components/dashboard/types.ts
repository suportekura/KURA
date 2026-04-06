export type Period = 'today' | '7d' | '14d' | '30d' | '90d' | 'all';

export interface SalesMetrics {
  totalSold: number;
  totalRevenue: number;
  activeListings: number;
  avgRating: number;
  reviewsCount: number;
  pendingOrders: number;
  confirmedOrders: number;
  deliveredOrders: number;
}

export interface PurchaseMetrics {
  totalPurchases: number;
  totalSpent: number;
  pendingOrders: number;
  deliveredOrders: number;
  avgRating: number;
  reviewsCount: number;
}

export interface DailyViewPoint {
  date: string;
  productViews: number;
  profileViews: number;
}

export interface CategorySalesPoint {
  name: string;
  count: number;
  revenue: number;
}

export interface PremiumMetrics {
  avgSellTimeDays: number | null;
  avgViewsPerProduct: number;
  totalViewsWeek: number;
  totalViewsMonth: number;
  profileViewsWeek: number;
  profileViewsMonth: number;
  bestSellingCategory: string | null;
  conversionRate: number | null;
  dailyViews: DailyViewPoint[];
  categorySales: CategorySalesPoint[];
  categorySalesConfirmed: CategorySalesPoint[];
  categorySalesInTransit: CategorySalesPoint[];
  categorySalesDelivered: CategorySalesPoint[];
  rawCategoryOrders: { category: string; status: string; revenue: number; created_at: string }[];
}

export interface ChartDataPoint {
  label: string;
  revenue: number;
  count: number;
}

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '14d', label: '14 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'all', label: 'Tudo' },
];

export const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const CATEGORY_LABELS: Record<string, string> = {
  camiseta: 'Camiseta',
  calca: 'Calça',
  vestido: 'Vestido',
  jaqueta: 'Jaqueta',
  saia: 'Saia',
  shorts: 'Shorts',
  blazer: 'Blazer',
  casaco: 'Casaco',
  acessorios: 'Acessórios',
  calcados: 'Calçados',
  outros: 'Outros',
};

export function getPeriodDays(period: Period): number | null {
  const map: Record<Period, number | null> = { today: 1, '7d': 7, '14d': 14, '30d': 30, '90d': 90, all: null };
  return map[period];
}

export function getDateThreshold(period: Period): string | null {
  const days = getPeriodDays(period);
  if (days === null) return null;
  const now = new Date();
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

export function buildChartData(
  orders: { status: string; total_price: number; created_at: string }[],
  period: Period,
): ChartDataPoint[] {
  const validStatuses = ['confirmed', 'in_transit', 'delivered'];
  const threshold = getDateThreshold(period);
  const filtered = threshold ? orders.filter(o => o.created_at >= threshold) : orders;
  const valid = filtered.filter(o => validStatuses.includes(o.status));

  const days = getPeriodDays(period);

  if (days !== null && days <= 90) {
    const buckets: Record<string, { revenue: number; count: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { revenue: 0, count: 0 };
    }
    valid.forEach(o => {
      const key = o.created_at.slice(0, 10);
      if (buckets[key]) {
        buckets[key].revenue += o.total_price || 0;
        buckets[key].count += 1;
      }
    });
    const entries = Object.entries(buckets);
    const labelInterval = days <= 7 ? 1 : days <= 14 ? 2 : days <= 30 ? 5 : 10;
    return entries.map(([date, v], i) => ({
      label: i % labelInterval === 0 ? new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '',
      ...v,
    }));
  }

  // "all" — monthly buckets for last 12 months
  const buckets: Record<string, { revenue: number; count: number }> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets[key] = { revenue: 0, count: 0 };
  }
  valid.forEach(o => {
    const key = o.created_at.slice(0, 7);
    if (buckets[key]) {
      buckets[key].revenue += o.total_price || 0;
      buckets[key].count += 1;
    }
  });
  return Object.entries(buckets).map(([key, v]) => ({
    label: MONTH_LABELS[parseInt(key.split('-')[1]) - 1],
    ...v,
  }));
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const formatShortCurrency = (value: number) => {
  if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`;
  return `R$${value.toFixed(0)}`;
};
