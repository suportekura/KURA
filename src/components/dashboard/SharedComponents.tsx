import React from 'react';
import { Lock, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CategorySalesPoint } from './types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from './types';

/* ── MetricCard ── */
export function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle?: string;
  color: 'primary' | 'secondary' | 'accent';
}) {
  const bgMap = { primary: 'bg-primary/10', secondary: 'bg-secondary/10', accent: 'bg-accent/10' };
  const iconMap = { primary: 'text-primary', secondary: 'text-secondary', accent: 'text-accent' };

  return (
    <div className="card-premium p-3 space-y-2">
      <div className={`w-8 h-8 rounded-lg ${bgMap[color]} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${iconMap[color]}`} />
      </div>
      <div>
        <p className="text-xl font-bold text-foreground leading-none">{value}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* ── PipelineRow ── */
export function PipelineRow({ label, value, variant }: { label: string; value: number; variant: 'warning' | 'info' | 'success' }) {
  const dotColors = { warning: 'bg-[hsl(43_80%_50%)]', info: 'bg-[hsl(210_60%_55%)]', success: 'bg-primary' };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${dotColors[variant]}`} />
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

/* ── UpgradeCTA ── */
export function UpgradeCTA() {
  return (
    <Link
      to="/plans"
      className="block card-premium p-5 border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            Desbloqueie o Dashboard completo
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Acesse métricas avançadas como tempo médio de venda, visualizações por anúncio, taxa de conversão e mais.
          </p>
          <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-primary">
            <Crown className="w-3 h-3" />
            Ver planos disponíveis
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ── CategorySalesCard ── */
export function CategorySalesCard({
  title,
  subtitle,
  data,
  color,
  dotClass,
}: {
  title: string;
  subtitle: string;
  data: CategorySalesPoint[];
  color: string;
  dotClass: string;
}) {
  if (data.length === 0) return null;

  return (
    <div className="card-premium p-4 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {title} <span className="normal-case">— {subtitle}</span>
      </p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(45 20% 88%)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(40 20% 35%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: 'hsl(40 20% 35%)' }} axisLine={false} tickLine={false} width={75} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid hsl(45 20% 88%)', fontSize: '12px', background: 'hsl(45 30% 97%)' }}
              formatter={(value: number) => [value, 'Vendas']}
            />
            <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} name="Vendas" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5">
        {data.map(cat => (
          <div key={cat.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${dotClass}`} />
              <span className="text-sm text-foreground">{cat.name}</span>
              <span className="text-[10px] text-muted-foreground">({cat.count})</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{formatCurrency(cat.revenue)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
