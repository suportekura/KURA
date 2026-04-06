import { ShoppingBag, TrendingUp, Star } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { MetricCard, PipelineRow } from './SharedComponents';
import { PurchaseMetrics, ChartDataPoint, formatCurrency, formatShortCurrency } from './types';

interface PurchasesTabProps {
  purchaseMetrics: PurchaseMetrics | null;
  purchaseChartData: ChartDataPoint[];
}

export function PurchasesTab({ purchaseMetrics, purchaseChartData }: PurchasesTabProps) {
  return (
    <section className="space-y-3 animate-fade-in">
      <div className="card-elevated p-5 space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Total gasto</p>
        <p className="text-3xl font-bold text-foreground tracking-tight">
          {formatCurrency(purchaseMetrics?.totalSpent || 0)}
        </p>
      </div>

      {/* Purchases Chart */}
      <div className="card-premium p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Evolução de gastos</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={purchaseChartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="purchaseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(50 40% 40%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(50 40% 40%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(45 20% 88%)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(40 20% 35%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(40 20% 35%)' }} axisLine={false} tickLine={false} tickFormatter={formatShortCurrency} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid hsl(45 20% 88%)', fontSize: '12px', background: 'hsl(45 30% 97%)' }}
                formatter={(value: number) => [formatCurrency(value), 'Gastos']}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(50 40% 40%)" strokeWidth={2} fill="url(#purchaseGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MetricCard icon={ShoppingBag} label="Compras" value={String(purchaseMetrics?.totalPurchases || 0)} color="secondary" />
        <MetricCard icon={TrendingUp} label="Pendentes" value={String(purchaseMetrics?.pendingOrders || 0)} color="accent" />
        <MetricCard icon={Star} label="Nota" value={purchaseMetrics?.avgRating.toFixed(1) || '5.0'} subtitle={`${purchaseMetrics?.reviewsCount || 0} aval.`} color="primary" />
      </div>

      <div className="card-premium p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status de entregas</p>
        <div className="space-y-2">
          <PipelineRow label="Pendentes" value={purchaseMetrics?.pendingOrders || 0} variant="warning" />
          <PipelineRow label="Entregues" value={purchaseMetrics?.deliveredOrders || 0} variant="success" />
        </div>
      </div>
    </section>
  );
}
