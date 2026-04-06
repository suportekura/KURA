import { useEffect, useState, useCallback } from 'react';
import { Search, MoreHorizontal, Shield, Crown, UserX, UserCheck, ChevronLeft, ChevronRight, Ban, ShieldOff, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAdmin, type AdminUser, type AdminUserDetails } from '@/hooks/useAdmin';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAGE_SIZE = 20;

export default function AdminUsers() {
  const { listUsers, getUserDetails, updateSubscription, updateBoosts, manageRole, suspendUser, loading } = useAdmin();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [fetching, setFetching] = useState(true);

  // Drawer
  const [selectedUser, setSelectedUser] = useState<AdminUserDetails | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Boost grant dialog
  const [boostGrant, setBoostGrant] = useState<{ userId: string; displayName: string } | null>(null);
  const [boostAmount, setBoostAmount] = useState(5);

  const fetchUsers = useCallback(async () => {
    setFetching(true);
    const result = await listUsers({
      search: search || undefined,
      planFilter: planFilter === 'all' ? undefined : planFilter,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    if (result) {
      setUsers(result.users);
      setTotal(result.total);
    }
    setFetching(false);
  }, [listUsers, search, planFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openUserDrawer = async (userId: string) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    const details = await getUserDetails(userId);
    setSelectedUser(details);
    setDrawerLoading(false);
  };

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

  const handleUpdatePlan = (userId: string, planType: string) => {
    setConfirmAction({
      title: `Alterar plano para ${planLabel(planType)}?`,
      description: 'Esta ação será registrada nos logs administrativos.',
      onConfirm: async () => {
        const success = await updateSubscription({
          targetUserId: userId,
          planType,
          expiresAt: planType === 'free' ? null : undefined,
        });
        if (success) {
          fetchUsers();
          if (drawerOpen) {
            const details = await getUserDetails(userId);
            setSelectedUser(details);
          }
        }
        setConfirmAction(null);
      },
    });
  };

  const handleUpdateBoosts = (userId: string, amount: number) => {
    setConfirmAction({
      title: `Definir ${amount} boosts para este usuário?`,
      description: 'Esta ação será registrada nos logs administrativos.',
      onConfirm: async () => {
        const success = await updateBoosts({ targetUserId: userId, totalBoosts: amount });
        if (success) {
          if (drawerOpen) {
            const details = await getUserDetails(userId);
            setSelectedUser(details);
          }
        }
        setConfirmAction(null);
      },
    });
  };

  const handleManageRole = (userId: string, role: 'admin' | 'moderator', action: 'add' | 'remove') => {
    const label = role === 'admin' ? 'Admin' : 'Moderador';
    setConfirmAction({
      title: `${action === 'add' ? 'Adicionar' : 'Remover'} papel de ${label}?`,
      description: action === 'add'
        ? `O usuário terá acesso ao painel de ${label.toLowerCase()}.`
        : `O acesso de ${label.toLowerCase()} será removido.`,
      onConfirm: async () => {
        const success = await manageRole({ targetUserId: userId, role, action });
        if (success) {
          fetchUsers();
          if (drawerOpen) {
            const details = await getUserDetails(userId);
            setSelectedUser(details);
          }
        }
        setConfirmAction(null);
      },
    });
  };

  const handleSuspend = (userId: string, suspend: boolean) => {
    setConfirmAction({
      title: suspend ? 'Suspender usuário?' : 'Reativar usuário?',
      description: suspend
        ? 'O usuário não poderá fazer login e seus anúncios serão ocultados.'
        : 'O usuário poderá fazer login novamente e seus anúncios voltarão a aparecer.',
      onConfirm: async () => {
        const success = await suspendUser({
          targetUserId: userId,
          suspend,
          reason: suspend ? 'Suspenso pelo administrador' : undefined,
        });
        if (success) {
          fetchUsers();
          if (drawerOpen) {
            const details = await getUserDetails(userId);
            setSelectedUser(details);
          }
        }
        setConfirmAction(null);
      },
    });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">{total} usuários cadastrados</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="plus">Pro</SelectItem>
            <SelectItem value="loja">Loja Oficial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead className="hidden sm:table-cell">Plano</TableHead>
              <TableHead className="hidden md:table-cell">Cadastro</TableHead>
              <TableHead className="hidden lg:table-cell">Último acesso</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fetching
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="flex items-center gap-3"><Skeleton className="w-8 h-8 rounded-full" /><Skeleton className="h-4 w-32" /></div></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              : users.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              )
              : users.map((user) => (
                <TableRow key={user.user_id} className="cursor-pointer" onClick={() => openUserDrawer(user.user_id)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user.avatar_url || ''} />
                        <AvatarFallback className="text-xs">
                          {(user.display_name || '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{user.display_name || user.full_name || 'Sem nome'}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.city || '—'}</p>
                      </div>
                      {user.roles?.includes('admin') && (
                        <Badge variant="outline" className="text-xs border-red-500/30 text-red-500">Admin</Badge>
                      )}
                      {user.roles?.includes('moderator') && (
                        <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-500">Mod</Badge>
                      )}
                      {user.suspended_at && (
                        <Badge variant="destructive" className="text-xs">Suspenso</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={planVariant(user.plan_type)} className="text-xs">
                      {planLabel(user.plan_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {format(new Date(user.created_at), 'dd/MM/yy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {format(new Date(user.updated_at), 'dd/MM/yy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="w-8 h-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => openUserDrawer(user.user_id)}>
                          Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.plan_type === 'loja' ? (
                          <DropdownMenuItem onClick={() => handleUpdatePlan(user.user_id, 'free')}>
                            <UserX className="w-4 h-4 mr-2" /> Remover plano
                          </DropdownMenuItem>
                        ) : user.plan_type === 'plus' ? (
                          <>
                            <DropdownMenuItem onClick={() => handleUpdatePlan(user.user_id, 'loja')}>
                              <Crown className="w-4 h-4 mr-2" /> Upgrade Loja Oficial
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdatePlan(user.user_id, 'free')}>
                              <UserX className="w-4 h-4 mr-2" /> Remover plano
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => handleUpdatePlan(user.user_id, 'plus')}>
                              <Crown className="w-4 h-4 mr-2" /> Conceder Pro
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdatePlan(user.user_id, 'loja')}>
                              <Crown className="w-4 h-4 mr-2" /> Conceder Loja Oficial
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem onClick={() => { setBoostAmount(5); setBoostGrant({ userId: user.user_id, displayName: user.display_name || user.full_name || 'Usuário' }); }}>
                          <Zap className="w-4 h-4 mr-2" /> Conceder Boosts
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {!user.roles?.includes('moderator') && (
                          <DropdownMenuItem onClick={() => handleManageRole(user.user_id, 'moderator', 'add')}>
                            <Shield className="w-4 h-4 mr-2" /> Tornar Moderador
                          </DropdownMenuItem>
                        )}
                        {user.roles?.includes('moderator') && (
                          <DropdownMenuItem onClick={() => handleManageRole(user.user_id, 'moderator', 'remove')}>
                            Remover Moderador
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {!user.roles?.includes('admin') && (
                          user.suspended_at ? (
                            <DropdownMenuItem onClick={() => handleSuspend(user.user_id, false)}>
                              <UserCheck className="w-4 h-4 mr-2" /> Reativar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="text-destructive" onClick={() => handleSuspend(user.user_id, true)}>
                              <Ban className="w-4 h-4 mr-2" /> Suspender
                            </DropdownMenuItem>
                          )
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* User Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes do Usuário</SheetTitle>
          </SheetHeader>
          {drawerLoading || !selectedUser ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-6 mt-6">
              {/* Profile header */}
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14">
                  <AvatarImage src={selectedUser.profile.avatar_url || ''} />
                  <AvatarFallback>{(selectedUser.profile.display_name || '?')[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-lg">{selectedUser.profile.display_name || selectedUser.profile.full_name || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.profile.city || '—'} · {selectedUser.profile.user_type === 'pj' ? 'PJ' : 'PF'}</p>
                  <div className="flex gap-1 mt-1">
                    {selectedUser.roles?.map(r => (
                      <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                    ))}
                    {selectedUser.profile.suspended_at && (
                      <Badge variant="destructive" className="text-xs">Suspenso</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Suspension banner */}
              {selectedUser.profile.suspended_at && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-destructive">Conta suspensa</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedUser.profile.suspension_reason || 'Sem motivo informado'}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleSuspend(selectedUser.profile.user_id, false)}>
                      <UserCheck className="w-3 h-3 mr-1" /> Reativar
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xl font-bold">{selectedUser.products_count}</p>
                  <p className="text-xs text-muted-foreground">Produtos</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{selectedUser.orders_as_seller}</p>
                  <p className="text-xs text-muted-foreground">Vendas</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{selectedUser.orders_as_buyer}</p>
                  <p className="text-xs text-muted-foreground">Compras</p>
                </div>
              </div>

              <Separator />

              {/* Subscription */}
              <div>
                <h3 className="font-medium mb-3">Assinatura</h3>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <Badge variant={planVariant(selectedUser.subscription?.plan_type || 'free')}>
                      {planLabel(selectedUser.subscription?.plan_type || 'free')}
                    </Badge>
                    {selectedUser.subscription?.expires_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Expira: {format(new Date(selectedUser.subscription.expires_at), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {selectedUser.subscription?.plan_type !== 'plus' && (
                      <Button size="sm" variant="outline" onClick={() => handleUpdatePlan(selectedUser.profile.user_id, 'plus')}>
                        <Crown className="w-3 h-3 mr-1" /> Pro
                      </Button>
                    )}
                    {selectedUser.subscription?.plan_type !== 'loja' && (
                      <Button size="sm" onClick={() => handleUpdatePlan(selectedUser.profile.user_id, 'loja')}>
                        <Crown className="w-3 h-3 mr-1" /> Loja Oficial
                      </Button>
                    )}
                    {selectedUser.subscription?.plan_type && selectedUser.subscription.plan_type !== 'free' && (
                      <Button size="sm" variant="destructive" onClick={() => handleUpdatePlan(selectedUser.profile.user_id, 'free')}>
                        Remover plano
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Boosts */}
              <div>
                <h3 className="font-medium mb-3">Boosts</h3>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm">
                      {selectedUser.boosts
                        ? `${selectedUser.boosts.total_boosts - selectedUser.boosts.used_boosts} disponíveis de ${selectedUser.boosts.total_boosts}`
                        : 'Nenhum boost'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleUpdateBoosts(selectedUser.profile.user_id, (selectedUser.boosts?.total_boosts || 0) + 5)}>
                      +5 boosts
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleUpdateBoosts(selectedUser.profile.user_id, (selectedUser.boosts?.total_boosts || 0) + 10)}>
                      +10 boosts
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Role management */}
              <div>
                <h3 className="font-medium mb-3">Permissões</h3>
                <div className="space-y-2">
                  {(['admin', 'moderator'] as const).map((role) => {
                    const hasRole = selectedUser.roles?.includes(role);
                    return (
                      <div key={role} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm capitalize">{role}</span>
                        <Button
                          size="sm"
                          variant={hasRole ? 'destructive' : 'outline'}
                          onClick={() => handleManageRole(selectedUser.profile.user_id, role, hasRole ? 'remove' : 'add')}
                        >
                          {hasRole ? 'Remover' : 'Adicionar'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Info */}
              <div>
                <h3 className="font-medium mb-3">Informações</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cadastro</span>
                    <span>{format(new Date(selectedUser.profile.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Último acesso</span>
                    <span>{format(new Date(selectedUser.profile.updated_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avaliações (vendedor)</span>
                    <span>{selectedUser.profile.seller_reviews_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Seguidores</span>
                    <span>{selectedUser.profile.followers_count}</span>
                  </div>
                </div>
              </div>

              {/* Suspend/Reactivate button */}
              {!selectedUser.roles?.includes('admin') && (
                <div>
                  <Separator className="mb-4" />
                  {selectedUser.profile.suspended_at ? (
                    <Button className="w-full" variant="outline" onClick={() => handleSuspend(selectedUser.profile.user_id, false)}>
                      <UserCheck className="w-4 h-4 mr-2" /> Reativar conta
                    </Button>
                  ) : (
                    <Button className="w-full" variant="destructive" onClick={() => handleSuspend(selectedUser.profile.user_id, true)}>
                      <Ban className="w-4 h-4 mr-2" /> Suspender conta
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction?.onConfirm} disabled={loading}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Boost Grant Dialog */}
      <AlertDialog open={!!boostGrant} onOpenChange={() => setBoostGrant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conceder créditos de boost</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione a quantidade de boosts para conceder a <strong>{boostGrant?.displayName}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-3 py-4">
            <label className="text-sm font-medium text-muted-foreground">Quantidade:</label>
            <div className="flex gap-2">
              {[1, 3, 5, 10, 20].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={boostAmount === n ? 'default' : 'outline'}
                  onClick={() => setBoostAmount(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={async () => {
                if (!boostGrant) return;
                // Fetch current boosts to add on top
                const details = await getUserDetails(boostGrant.userId);
                const currentTotal = details?.boosts?.total_boosts || 0;
                const success = await updateBoosts({
                  targetUserId: boostGrant.userId,
                  totalBoosts: currentTotal + boostAmount,
                  note: `Admin concedeu +${boostAmount} boosts`,
                });
                if (success) {
                  fetchUsers();
                  if (drawerOpen) {
                    const updated = await getUserDetails(boostGrant.userId);
                    setSelectedUser(updated);
                  }
                }
                setBoostGrant(null);
              }}
            >
              <Zap className="w-4 h-4 mr-1" /> Conceder {boostAmount} boost{boostAmount > 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
