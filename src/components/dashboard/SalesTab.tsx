import { useMemo } from 'react';
import { Package, Eye, Star } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { MetricCard, PipelineRow } from './SharedComponents';
import { SalesMetrics, ChartDataPoint, PremiumMetrics, Period, formatCurrency, formatShortCurrency, buildChartData } from './types';
import { PremiumMetricsSection } from './PremiumMetricsSection';

interface SalesTabProps {
  salesMetrics: SalesMetrics | null;
  salesChartData: ChartDataPoint[];
  hasSubscription: boolean;
  premiumMetrics: PremiumMetrics | null;
  period: Period;
}

export function SalesTab({ salesMetrics, salesChartData, hasSubscription, premiumMetrics, period }: SalesTabProps) {
  return (
    <section className="space-y-3 animate-fade-in">
      <div className="card-elevated p-5 space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Receita total</p>
        <p className="text-3xl font-bold text-foreground tracking-tight">
          {formatCurrency(salesMetrics?.totalRevenue || 0)}
        </p>
      </div>

      {/* Sales Chart */}
      <div className="card-premium p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Evolução de receita</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesChartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(80 60% 35%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(80 60% 35%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(45 20% 88%)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(40 20% 35%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(40 20% 35%)' }} axisLine={false} tickLine={false} tickFormatter={formatShortCurrency} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid hsl(45 20% 88%)', fontSize: '12px', background: 'hsl(45 30% 97%)' }}
                formatter={(value: number) => [formatCurrency(value), 'Receita']}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(80 60% 35%)" strokeWidth={2} fill="url(#salesGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MetricCard icon={Package} label="Vendidos" value={String(salesMetrics?.totalSold || 0)} color="primary" />
        <MetricCard icon={Eye} label="Ativos" value={String(salesMetrics?.activeListings || 0)} color="accent" />
        <MetricCard icon={Star} label="Nota" value={salesMetrics?.avgRating.toFixed(1) || '5.0'} subtitle={`${salesMetrics?.reviewsCount || 0} aval.`} color="secondary" />
      </div>

      <div className="card-premium p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pipeline de pedidos</p>
        <div className="space-y-2">
          <PipelineRow label="Pendentes" value={salesMetrics?.pendingOrders || 0} variant="warning" />
          <PipelineRow label="Em andamento" value={salesMetrics?.confirmedOrders || 0} variant="info" />
          <PipelineRow label="Entregues" value={salesMetrics?.deliveredOrders || 0} variant="success" />
        </div>
      </div>

      {/* Premium Metrics Section */}
      {hasSubscription && premiumMetrics ? (
        <PremiumMetricsSection metrics={premiumMetrics} period={period} />
      ) : null}
    </section>
  );
}
