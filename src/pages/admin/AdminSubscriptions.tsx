import { useEffect, useState, useCallback } from 'react';
import { CreditCard, TrendingUp, TrendingDown, Users, Crown, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Period = '7d' | '30d' | '90d';

interface SubStats {
  totalActive: number;
  activePlus: number;
  activeLoja: number;
  newThisPeriod: number;
  expiredThisPeriod: number;
  revenueThisPeriod: number;
  forecastedRevenue: number;
  annualCount: number;
  monthlyCount: number;
  mrrPlus: number;
  mrrLoja: number;
}

interface DailyPoint {
  date: string;
  plus: number;
  loja: number;
}

interface RecentSub {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  plan_type: string;
  created_at: string;
  expires_at: string | null;
}

const planLabel = (plan: string) => {
  if (plan === 'loja') return 'Loja Oficial';
  if (plan === 'plus') return 'Pro';
  return 'Free';
};

const planVariant = (plan: string): 'default' | 'secondary' | 'outline' => {
  if (plan === 'loja') return 'default';
  if (plan === 'plus') return 'outline';
  return 'secondary';
};

export default function AdminSubscriptions() {
  const [period, setPeriod] = useState<Period>('30d');
  const [stats, setStats] = useState<SubStats | null>(null);
  const [dailyData, setDailyData] = useState<DailyPoint[]>([]);
  const [recentSubs, setRecentSubs] = useState<RecentSub[]>([]);
  const [loading, setLoading] = useState(true);

  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const since = subDays(now, periodDays).toISOString();

    // Fetch all subscriptions
    const { data: allSubs } = await supabase
      .from('user_subscriptions')
      .select('user_id, plan_type, expires_at, created_at, updated_at');

    const subs = allSubs || [];

    // Active subs (not expired)
    const active = subs.filter(s =>
      s.plan_type !== 'free' &&
      (!s.expires_at || new Date(s.expires_at) > now)
    );
    const activePlus = active.filter(s => s.plan_type === 'plus').length;
    const activeLoja = active.filter(s => s.plan_type === 'loja').length;

    // New in period
    const newInPeriod = subs.filter(s =>
      s.plan_type !== 'free' && s.created_at >= since
    ).length;

    // Expired in period
    const expiredInPeriod = subs.filter(s =>
      s.expires_at &&
      new Date(s.expires_at) <= now &&
      new Date(s.expires_at) >= new Date(since)
    ).length;

    // Revenue from plan_payments in period
    const { data: payments } = await supabase
      .from('plan_payments')
      .select('amount, status')
      .gte('created_at', since)
      .in('status', ['paid', 'confirmed']);

    const revenue = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

    // Forecast: calculate from active subs
    // Annual subs: expires_at - created_at > 2 months
    const TWO_MONTHS_MS = 2 * 30 * 24 * 60 * 60 * 1000; // 60 days in ms
    // Plan prices (monthly): plus=39.90, loja=99.90 | annual: plus=383.04, loja=959.04
    const monthlyPrices: Record<string, number> = { plus: 39.90, loja: 99.90 };
    const annualPrices: Record<string, number> = { plus: 383.04, loja: 959.04 };

    let forecastedRevenue = 0;
    let annualCount = 0;
    let monthlyCount = 0;
    let mrrPlus = 0;
    let mrrLoja = 0;

    active.forEach(s => {
      const isAnnual = s.expires_at && s.created_at &&
        (new Date(s.expires_at).getTime() - new Date(s.created_at).getTime()) > TWO_MONTHS_MS;

      const monthlyPrice = monthlyPrices[s.plan_type] || 0;

      if (isAnnual) {
        annualCount++;
        const remainingMs = new Date(s.expires_at!).getTime() - now.getTime();
        const remainingMonths = Math.max(0, remainingMs / (30 * 24 * 60 * 60 * 1000));
        forecastedRevenue += monthlyPrice * remainingMonths;
        // Annual MRR = annual price / 12
        const annualPrice = annualPrices[s.plan_type] || 0;
        if (s.plan_type === 'plus') mrrPlus += annualPrice / 12;
        else if (s.plan_type === 'loja') mrrLoja += annualPrice / 12;
      } else {
        monthlyCount++;
        forecastedRevenue += monthlyPrice;
        if (s.plan_type === 'plus') mrrPlus += monthlyPrice;
        else if (s.plan_type === 'loja') mrrLoja += monthlyPrice;
      }
    });

    setStats({
      totalActive: active.length,
      activePlus,
      activeLoja,
      newThisPeriod: newInPeriod,
      expiredThisPeriod: expiredInPeriod,
      revenueThisPeriod: revenue,
      forecastedRevenue: Math.round(forecastedRevenue * 100) / 100,
      annualCount,
      monthlyCount,
      mrrPlus: Math.round(mrrPlus * 100) / 100,
      mrrLoja: Math.round(mrrLoja * 100) / 100,
    });

    // Build daily chart data
    const dailyMap: Record<string, { plus: number; loja: number }> = {};
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = subDays(now, i);
      const key = format(d, 'yyyy-MM-dd');
      dailyMap[key] = { plus: 0, loja: 0 };
    }

    // Count new subscriptions per day
    subs.filter(s => s.plan_type !== 'free' && s.created_at >= since).forEach(s => {
      const key = s.created_at.slice(0, 10);
      if (dailyMap[key]) {
        if (s.plan_type === 'plus') dailyMap[key].plus++;
        if (s.plan_type === 'loja') dailyMap[key].loja++;
      }
    });

    setDailyData(
      Object.entries(dailyMap).map(([date, vals]) => ({
        date: format(new Date(date), 'dd/MM'),
        plus: vals.plus,
        loja: vals.loja,
      }))
    );

    // Recent subscriptions with profile info
    const recentIds = subs
      .filter(s => s.plan_type !== 'free')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 20);

    if (recentIds.length > 0) {
      const userIds = [...new Set(recentIds.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      setRecentSubs(recentIds.map(s => ({
        user_id: s.user_id,
        display_name: profileMap.get(s.user_id)?.display_name || null,
        avatar_url: profileMap.get(s.user_id)?.avatar_url || null,
        plan_type: s.plan_type,
        created_at: s.created_at,
        expires_at: s.expires_at,
      })));
    } else {
      setRecentSubs([]);
    }

    setLoading(false);
  }, [periodDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const tickInterval = period === '7d' ? 0 : period === '30d' ? 6 : 14;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Assinaturas</h1>
          <p className="text-sm text-muted-foreground mt-1">Métricas de assinaturas e receita</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
            <SelectItem value="90d">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={Users} label="Ativas" value={String(stats.totalActive)} />
            <KpiCard icon={Crown} label="Pro" value={String(stats.activePlus)} color="secondary" />
            <KpiCard icon={Crown} label="Loja Oficial" value={String(stats.activeLoja)} color="primary" />
            <KpiCard icon={ArrowUpRight} label="Novas" value={String(stats.newThisPeriod)} color="accent" />
            <KpiCard icon={ArrowDownRight} label="Expiradas" value={String(stats.expiredThisPeriod)} color="destructive" />
            <KpiCard icon={CreditCard} label="Receita" value={formatCurrency(stats.revenueThisPeriod)} color="primary" />
          </div>

          {/* Revenue Forecast */}
          <div className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Previsão de receita</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.forecastedRevenue)}</p>
                <p className="text-xs text-muted-foreground">Receita prevista restante</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-foreground">{stats.annualCount}</p>
                <p className="text-xs text-muted-foreground">Assinaturas anuais</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-foreground">{stats.monthlyCount}</p>
                <p className="text-xs text-muted-foreground">Assinaturas mensais</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(stats.mrrPlus + stats.mrrLoja)}
                </p>
                <p className="text-xs text-muted-foreground">MRR total</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.mrrPlus)}</p>
                <p className="text-xs text-muted-foreground">MRR Plus (R$39,90/mês · R$383,04/ano)</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.mrrLoja)}</p>
                <p className="text-xs text-muted-foreground">MRR Loja (R$99,90/mês · R$959,04/ano)</p>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Daily Chart */}
      <div className="rounded-lg border border-border/50 bg-card p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Novas assinaturas por dia</p>
        <div className="h-52">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="plusGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lojaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={tickInterval} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '12px', background: 'hsl(var(--card))' }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                />
                <Area type="monotone" dataKey="plus" name="Pro" stroke="hsl(var(--secondary))" strokeWidth={2} fill="url(#plusGrad)" />
                <Area type="monotone" dataKey="loja" name="Loja Oficial" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#lojaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="flex items-center justify-center gap-4 pt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
            <span className="text-[10px] text-muted-foreground">Pro</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-[10px] text-muted-foreground">Loja Oficial</span>
          </div>
        </div>
      </div>

      {/* Recent Subscriptions Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h2 className="font-medium text-sm">Assinaturas recentes</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead className="hidden sm:table-cell">Início</TableHead>
              <TableHead className="hidden md:table-cell">Expira</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))
            ) : recentSubs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  Nenhuma assinatura encontrada
                </TableCell>
              </TableRow>
            ) : (
              recentSubs.map((sub, i) => {
                const isExpired = sub.expires_at && new Date(sub.expires_at) <= new Date();
                return (
                  <TableRow key={`${sub.user_id}-${i}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={sub.avatar_url || ''} />
                          <AvatarFallback className="text-xs">
                            {(sub.display_name || '?')[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{sub.display_name || 'Sem nome'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={planVariant(sub.plan_type)} className="text-xs">
                        {planLabel(sub.plan_type)}
                      </Badge>
                      {isExpired && (
                        <Badge variant="destructive" className="text-xs ml-1">Expirado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {format(new Date(sub.created_at), 'dd/MM/yy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {sub.expires_at ? format(new Date(sub.expires_at), 'dd/MM/yy', { locale: ptBR }) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color = 'foreground',
}: {
  icon: any;
  label: string;
  value: string;
  color?: 'primary' | 'secondary' | 'accent' | 'destructive' | 'foreground';
}) {
  const colorMap = {
    primary: 'text-primary bg-primary/10',
    secondary: 'text-secondary bg-secondary/10',
    accent: 'text-accent bg-accent/10',
    destructive: 'text-destructive bg-destructive/10',
    foreground: 'text-foreground bg-muted',
  };
  const [iconColor, iconBg] = colorMap[color].split(' ');

  return (
    <div className="rounded-lg border border-border/50 bg-card p-3 space-y-2">
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className="text-xl font-bold text-foreground leading-none truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}
