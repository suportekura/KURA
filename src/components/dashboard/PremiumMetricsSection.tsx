import { useState, useMemo } from 'react';
import { Clock, Eye, BarChart3, Users, Crown, TrendingUp, Package } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CategorySalesCard } from './SharedComponents';
import {
  PremiumMetrics,
  Period,
  CategorySalesPoint,
  CATEGORY_LABELS,
  getDateThreshold,
  formatCurrency,
} from './types';

interface PremiumMetricsSectionProps {
  metrics: PremiumMetrics;
  period: Period;
}

export function PremiumMetricsSection({ metrics, period }: PremiumMetricsSectionProps) {
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d'>('30d');
  const chartData = chartPeriod === '7d' ? metrics.dailyViews.slice(-7) : metrics.dailyViews;
  const chartInterval = chartPeriod === '7d' ? 0 : 6;

  // Filter raw category orders by period
  const filteredCategoryData = useMemo(() => {
    const threshold = getDateThreshold(period);
    const filtered = threshold
      ? metrics.rawCategoryOrders.filter(o => o.created_at >= threshold)
      : metrics.rawCategoryOrders;

    const build = (statusFilter?: string): CategorySalesPoint[] => {
      const orders = statusFilter ? filtered.filter(o => o.status === statusFilter) : filtered;
      const map: Record<string, { count: number; revenue: number }> = {};
      for (const o of orders) {
        const name = CATEGORY_LABELS[o.category] || o.category;
        if (!map[name]) map[name] = { count: 0, revenue: 0 };
        map[name].count += 1;
        map[name].revenue += o.revenue;
      }
      return Object.entries(map)
        .map(([name, val]) => ({ name, count: val.count, revenue: val.revenue }))
        .sort((a, b) => b.revenue - a.revenue);
    };

    return {
      all: build(),
      confirmed: build('confirmed'),
      inTransit: build('in_transit'),
      delivered: build('delivered'),
    };
  }, [metrics.rawCategoryOrders, period]);

  const totalSalesCount = filteredCategoryData.all.reduce((s, c) => s + c.count, 0);
  const totalSalesRevenue = filteredCategoryData.all.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Crown className="w-4 h-4 text-primary" />
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Métricas avançadas</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PremiumMetricCard icon={Clock} label="Tempo médio de venda" value={metrics.avgSellTimeDays !== null ? `${metrics.avgSellTimeDays}d` : '—'} color="primary" />
        <PremiumMetricCard icon={Eye} label="Views médias / anúncio" value={String(metrics.avgViewsPerProduct)} color="secondary" />
        <PremiumMetricCard icon={BarChart3} label="Views na semana" value={String(metrics.totalViewsWeek)} color="accent" />
        <PremiumMetricCard icon={BarChart3} label="Views no mês" value={String(metrics.totalViewsMonth)} color="primary" />
        <PremiumMetricCard icon={Users} label="Visitas ao perfil (semana)" value={String(metrics.profileViewsWeek)} color="secondary" />
        <PremiumMetricCard icon={Users} label="Visitas ao perfil (mês)" value={String(metrics.profileViewsMonth)} color="accent" />
      </div>

      {/* Daily Views Chart */}
      <div className="card-premium p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Visualizações diárias</p>
          <div className="flex rounded-lg overflow-hidden border border-border/50">
            <button
              onClick={() => setChartPeriod('7d')}
              className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${chartPeriod === '7d' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              7 dias
            </button>
            <button
              onClick={() => setChartPeriod('30d')}
              className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${chartPeriod === '30d' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              30 dias
            </button>
          </div>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="prodViewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profViewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(45 20% 88%)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(40 20% 35%)' }} axisLine={false} tickLine={false} interval={chartInterval} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(40 20% 35%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid hsl(45 20% 88%)', fontSize: '12px', background: 'hsl(45 30% 97%)' }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Area type="monotone" dataKey="productViews" name="Anúncios" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#prodViewsGrad)" />
              <Area type="monotone" dataKey="profileViews" name="Perfil" stroke="hsl(var(--secondary))" strokeWidth={2} fill="url(#profViewsGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 pt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-[10px] text-muted-foreground">Anúncios</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
            <span className="text-[10px] text-muted-foreground">Perfil</span>
          </div>
        </div>
      </div>

      {/* Total Summary */}
      {filteredCategoryData.all.length > 0 && (
        <div className="card-premium p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resumo geral por categoria</p>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">{formatCurrency(totalSalesRevenue)}</p>
              <p className="text-[10px] text-muted-foreground">{totalSalesCount} vendas</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {filteredCategoryData.all.map(cat => (
              <div key={cat.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-sm text-foreground">{cat.name}</span>
                  <span className="text-[10px] text-muted-foreground">({cat.count})</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{formatCurrency(cat.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Sales by Status */}
      <CategorySalesCard title="Confirmados" subtitle="por categoria" data={filteredCategoryData.confirmed} color="hsl(43 80% 50%)" dotClass="bg-[hsl(43_80%_50%)]" />
      <CategorySalesCard title="Em trânsito" subtitle="por categoria" data={filteredCategoryData.inTransit} color="hsl(210 60% 55%)" dotClass="bg-[hsl(210_60%_55%)]" />
      <CategorySalesCard title="Entregues" subtitle="por categoria" data={filteredCategoryData.delivered} color="hsl(var(--primary))" dotClass="bg-primary" />

      {/* Insights */}
      <div className="card-premium p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Insights</p>
        <div className="space-y-2">
          {metrics.conversionRate !== null && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm text-foreground">Taxa de conversão</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{metrics.conversionRate}%</span>
            </div>
          )}
          {metrics.bestSellingCategory && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-secondary" />
                <span className="text-sm text-foreground">Categoria mais vendida</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {CATEGORY_LABELS[metrics.bestSellingCategory] || metrics.bestSellingCategory}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Small helper ── */
function PremiumMetricCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: 'primary' | 'secondary' | 'accent' }) {
  const bgMap = { primary: 'bg-primary/10', secondary: 'bg-secondary/10', accent: 'bg-accent/10' };
  const iconMap = { primary: 'text-primary', secondary: 'text-secondary', accent: 'text-accent' };

  return (
    <div className="card-premium p-3 space-y-1.5">
      <div className={`w-7 h-7 rounded-lg ${bgMap[color]} flex items-center justify-center`}>
        <Icon className={`w-3.5 h-3.5 ${iconMap[color]}`} />
      </div>
      <p className="text-lg font-bold text-foreground leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
