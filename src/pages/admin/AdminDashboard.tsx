import { useEffect, useState, useMemo } from 'react';
import { Users, ShoppingBag, Package, ClipboardList, TrendingUp, UserPlus, Crown, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAdmin, type DashboardStats, type AnalyticsData } from '@/hooks/useAdmin';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PERIOD_OPTIONS = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
];

const PIE_COLORS = ['hsl(var(--muted-foreground))', 'hsl(var(--primary))'];

const categoryLabels: Record<string, string> = {
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

export default function AdminDashboard() {
  const { getDashboardStats, getAnalytics } = useAdmin();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getDashboardStats(),
      getAnalytics(period),
    ]).then(([statsData, analyticsData]) => {
      setStats(statsData);
      setAnalytics(analyticsData);
      setLoading(false);
    });
  }, [getDashboardStats, getAnalytics, period]);

  const cards = stats
    ? [
        { label: 'Total de Usuários', value: stats.total_users, icon: Users, color: 'text-primary' },
        { label: 'Ativos (30d)', value: stats.active_users_30d, icon: TrendingUp, color: 'text-primary' },
        { label: 'Novos (7d)', value: stats.new_users_7d, icon: UserPlus, color: 'text-primary' },
        { label: 'Usuários Pro', value: stats.pro_users, icon: Crown, color: 'text-primary' },
        { label: 'MRR Estimado', value: `R$ ${(stats.pro_users * 39).toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-primary' },
        { label: 'Fila de Moderação', value: stats.moderation_queue, icon: ClipboardList, color: stats.moderation_queue > 0 ? 'text-destructive' : 'text-muted-foreground' },
        { label: 'Produtos Ativos', value: stats.total_products, icon: Package, color: 'text-primary' },
        { label: 'Pedidos', value: stats.total_orders, icon: ShoppingBag, color: 'text-primary' },
      ]
    : [];

  const formatDay = (day: string) => {
    try {
      return format(parseISO(day), 'dd/MM', { locale: ptBR });
    } catch {
      return day;
    }
  };

  const signupsData = useMemo(() =>
    analytics?.daily_signups?.map(d => ({ ...d, day: formatDay(d.day) })) || [],
    [analytics]
  );

  const ordersData = useMemo(() =>
    analytics?.daily_orders?.map(d => ({ ...d, day: formatDay(d.day) })) || [],
    [analytics]
  );

  const productsData = useMemo(() =>
    analytics?.daily_products?.map(d => ({ ...d, day: formatDay(d.day) })) || [],
    [analytics]
  );

  const pieData = useMemo(() => {
    if (!analytics?.plans_distribution) return [];
    return [
      { name: 'Free', value: Number(analytics.plans_distribution.free) },
      { name: 'Pro', value: Number(analytics.plans_distribution.pro) },
    ];
  }, [analytics]);

  const categoriesData = useMemo(() =>
    analytics?.top_categories?.map(c => ({
      name: categoryLabels[c.name] || c.name,
      total: c.total,
    })) || [],
    [analytics]
  );

  const tooltipStyle = {
    contentStyle: {
      background: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '8px',
      fontSize: '12px',
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral do sistema</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {PERIOD_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              size="sm"
              variant={period === opt.value ? 'default' : 'ghost'}
              className="text-xs h-7 px-3"
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2"><Skeleton className="h-4 w-20" /></CardHeader>
                <CardContent><Skeleton className="h-7 w-14" /></CardContent>
              </Card>
            ))
          : cards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
                    <Icon className={`w-4 h-4 ${card.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{card.value}</div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Signups Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Novos cadastros</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={signupsData}>
                  <defs>
                    <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#signupGrad)" strokeWidth={2} name="Cadastros" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Revenue Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Receita de pedidos (R$)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={ordersData}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip {...tooltipStyle} formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Receita']} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revenueGrad)" strokeWidth={2} name="Receita" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Orders count */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pedidos por dia</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ordersData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Pedidos" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Categories */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Categorias mais populares</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoriesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={70} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Produtos" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Plans distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Distribuição de planos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 text-xs">
                  {pieData.map((entry, i) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                      <span className="text-muted-foreground">{entry.name}: <strong className="text-foreground">{entry.value}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Products chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Novos produtos ativos por dia</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={productsData}>
                <defs>
                  <linearGradient id="productsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#productsGrad)" strokeWidth={2} name="Produtos" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
