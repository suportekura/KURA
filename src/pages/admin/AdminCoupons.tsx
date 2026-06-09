import { useEffect, useState, useCallback } from 'react';
import { Plus, Tag, Pencil, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  applies_to: string;
  max_uses: number | null;
  expires_at: string;
  active: boolean;
  created_at: string;
  uses_count?: number;
}

const APPLIES_TO_LABEL: Record<string, string> = {
  boost_24h: 'Boost 24h',
  boost_3d: 'Boost 3 dias',
  boost_7d: 'Boost 7 dias',
  all_boosts: 'Todos os boosts',
  plan_plus: 'Plano Plus',
  plan_loja: 'Plano Loja',
  all_plans: 'Todos os planos',
  all: 'Tudo',
};

function couponStatus(c: Coupon): 'active' | 'expired' | 'inactive' {
  if (!c.active) return 'inactive';
  if (new Date(c.expires_at) < new Date()) return 'expired';
  return 'active';
}

const emptyForm = {
  code: '',
  discount_type: 'percentage' as 'percentage' | 'fixed',
  discount_value: '',
  applies_to: 'all_boosts',
  max_uses: '',
  unlimited: true,
  expires_at: '',
  active: true,
};

export default function AdminCoupons() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admin_coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      const withCounts = await Promise.all(
        data.map(async (c) => {
          const { count } = await supabase
            .from('admin_coupon_uses')
            .select('id', { count: 'exact', head: true })
            .eq('coupon_id', c.id);
          return { ...c, uses_count: count ?? 0 };
        })
      );
      setCoupons(withCounts);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setForm(f => ({ ...f, code }));
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditId(c.id);
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      applies_to: c.applies_to,
      max_uses: c.max_uses ? String(c.max_uses) : '',
      unlimited: c.max_uses === null,
      expires_at: c.expires_at.slice(0, 16),
      active: c.active,
    });
    setDialogOpen(true);
  };

  const handleToggleActive = async (c: Coupon) => {
    await supabase.from('admin_coupons').update({ active: !c.active }).eq('id', c.id);
    fetchCoupons();
  };

  const handleSave = async () => {
    if (!form.code || !form.discount_value || !form.expires_at || !form.applies_to) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    const discountVal = parseFloat(form.discount_value);
    if (isNaN(discountVal) || discountVal <= 0) {
      toast({ title: 'Valor de desconto inválido', variant: 'destructive' });
      return;
    }
    if (form.discount_type === 'percentage' && discountVal > 100) {
      toast({ title: 'Desconto percentual não pode ser maior que 100%', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      code: form.code.toUpperCase().trim(),
      discount_type: form.discount_type,
      discount_value: discountVal,
      applies_to: form.applies_to,
      max_uses: form.unlimited ? null : (parseInt(form.max_uses) || null),
      expires_at: new Date(form.expires_at).toISOString(),
      active: form.active,
      ...(editId ? {} : { created_by: user!.id }),
    };
    const { error } = editId
      ? await supabase.from('admin_coupons').update(payload).eq('id', editId)
      : await supabase.from('admin_coupons').insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar cupom', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editId ? 'Cupom atualizado!' : 'Cupom criado!' });
    setDialogOpen(false);
    fetchCoupons();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cupons</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie cupons de desconto para boosts e planos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCoupons}><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Atualizar</Button>
          <Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1.5" />Novo cupom</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead>Aplica-se a</TableHead>
              <TableHead>Usos</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : coupons.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum cupom criado</TableCell></TableRow>
            ) : coupons.map(c => {
              const status = couponStatus(c);
              return (
                <TableRow key={c.id}>
                  <TableCell><code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">{c.code}</code></TableCell>
                  <TableCell className="text-sm">
                    {c.discount_type === 'percentage' ? `${c.discount_value}%` : `R$ ${c.discount_value.toFixed(2).replace('.', ',')}`}
                  </TableCell>
                  <TableCell className="text-sm">{APPLIES_TO_LABEL[c.applies_to] ?? c.applies_to}</TableCell>
                  <TableCell className="text-sm">{c.uses_count ?? 0}{c.max_uses ? ` / ${c.max_uses}` : ''}</TableCell>
                  <TableCell className="text-sm">{format(new Date(c.expires_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</TableCell>
                  <TableCell>
                    <Badge variant={status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {status === 'active' ? 'Ativo' : status === 'expired' ? 'Expirado' : 'Desativado'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(c)}>
                        {c.active ? <ToggleRight className="w-3.5 h-3.5 text-primary" /> : <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              {editId ? 'Editar cupom' : 'Novo cupom'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Código *</Label>
              <div className="flex gap-2">
                <Input
                  className="uppercase"
                  placeholder="EX: BOOST20"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                />
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={generateCode}>
                  Gerar
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.discount_type} onValueChange={v => setForm(f => ({ ...f, discount_type: v as 'percentage' | 'fixed' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  min="0.01"
                  max={form.discount_type === 'percentage' ? '100' : undefined}
                  step="0.01"
                  placeholder={form.discount_type === 'percentage' ? '20' : '5.00'}
                  value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Aplica-se a *</Label>
              <Select value={form.applies_to} onValueChange={v => setForm(f => ({ ...f, applies_to: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(APPLIES_TO_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Limite de usos</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ilimitado</span>
                  <Switch checked={form.unlimited} onCheckedChange={v => setForm(f => ({ ...f, unlimited: v, max_uses: '' }))} />
                </div>
              </div>
              {!form.unlimited && (
                <Input
                  type="number"
                  min="1"
                  placeholder="100"
                  value={form.max_uses}
                  onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Validade *</Label>
              <Input
                type="datetime-local"
                value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editId ? 'Salvar' : 'Criar cupom'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
