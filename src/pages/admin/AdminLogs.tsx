import { useEffect, useState, useCallback } from 'react';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdmin, type AdminLog } from '@/hooks/useAdmin';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAGE_SIZE = 50;

const actionLabels: Record<string, string> = {
  update_subscription: 'Alterar assinatura',
  update_boosts: 'Alterar boosts',
  add_role: 'Adicionar papel',
  remove_role: 'Remover papel',
  suspend_user: 'Suspender usuário',
  unsuspend_user: 'Reativar usuário',
};

const actionColors: Record<string, string> = {
  update_subscription: 'bg-amber-500/10 text-amber-600',
  update_boosts: 'bg-blue-500/10 text-blue-600',
  add_role: 'bg-green-500/10 text-green-600',
  remove_role: 'bg-red-500/10 text-red-600',
  suspend_user: 'bg-destructive/10 text-destructive',
  unsuspend_user: 'bg-green-500/10 text-green-600',
};

export default function AdminLogs() {
  const { getLogs } = useAdmin();
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [fetching, setFetching] = useState(true);

  const fetchLogs = useCallback(async () => {
    setFetching(true);
    const result = await getLogs({
      actionFilter: actionFilter === 'all' ? undefined : actionFilter,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    if (result) {
      setLogs(result.logs);
      setTotal(result.total);
    }
    setFetching(false);
  }, [getLogs, actionFilter, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Logs Administrativos</h1>
        <p className="text-sm text-muted-foreground mt-1">{total} registros</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo de ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            <SelectItem value="update_subscription">Assinaturas</SelectItem>
            <SelectItem value="update_boosts">Boosts</SelectItem>
            <SelectItem value="add_role">Adicionar papel</SelectItem>
            <SelectItem value="remove_role">Remover papel</SelectItem>
            <SelectItem value="suspend_user">Suspender</SelectItem>
            <SelectItem value="unsuspend_user">Reativar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ação</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead className="hidden sm:table-cell">Alvo</TableHead>
              <TableHead className="hidden md:table-cell">Detalhes</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fetching
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))
              : logs.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <ScrollText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhum log encontrado</p>
                  </TableCell>
                </TableRow>
              )
              : logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Badge variant="secondary" className={`text-xs ${actionColors[log.action] || ''}`}>
                      {actionLabels[log.action] || log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.admin_name || 'Admin'}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground font-mono">
                    {log.target_id ? log.target_id.slice(0, 8) + '...' : '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                    {log.metadata ? JSON.stringify(log.metadata) : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</p>
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
    </div>
  );
}
