# Queue Wait Flow — Design

**Data:** 2026-03-30
**Status:** Aprovado

---

## Contexto

O sistema de fila de espera (`product_queue`) permite que compradores entrem numa lista de espera para produtos com status `reserved`. O backend já está ~70% completo: todos os RPCs principais existem, e triggers de banco já acionam promoção automática nos eventos corretos. O gap é quase inteiramente no frontend — o `ProductDetail` não consegue distinguir um usuário com status `promoted` de um usuário que saiu da fila, porque o RPC `get_queue_info` não retorna essa informação.

### O que já está funcionando (não escopo desta tarefa)

- `join_product_queue`, `leave_product_queue`, `get_queue_info`, `promote_next_in_queue`, `cleanup_expired_reservations` — todos implementados
- Trigger `on_order_cancelled_promote_queue`: quando uma ordem é cancelada → promove próximo automaticamente
- Trigger `on_product_sold_clear_queue`: quando produto vira `sold` → cancela toda a fila
- `cleanup_expired_reservations`: promoção expira (30 min) → promove próximo
- `useProductQueue` hook com `joinQueue` / `leaveQueue`
- `QueueViewSheet`: lista usuários em espera (vendedor)
- Badge de contagem em `MyListings`
- Notificação tipo `queue_promotion` com navegação para a página do produto
- RLS policies para `product_queue` já existem na migration inicial (`"Users can view own queue entries"` e `"Sellers can view queue for own products"`) — **não recriar**

---

## Escopo

### Arquivos modificados

| Arquivo | Tipo de mudança |
|---|---|
| `supabase/migrations/<timestamp>_queue_get_info_promoted_fields.sql` | Nova migration — apenas atualizar `get_queue_info` RPC |
| `src/hooks/useProductQueue.ts` | Atualizar retorno do hook |
| `src/pages/ProductDetail.tsx` | Banner de promoção + countdown + botão "Comprar agora" |
| `src/components/seller/QueueViewSheet.tsx` | Promovido no topo + botão "Promover próximo" |

---

## Design Detalhado

### 1. Migration: atualizar `get_queue_info`

O RPC atual retorna `{queue_count, user_position, user_in_queue}`. Quando o usuário tem `status='promoted'`, o `user_in_queue` retorna `false` e `user_position` retorna `null` — o frontend não consegue distinguir do caso em que o usuário nunca entrou na fila.

**Nota:** As RLS policies para `product_queue` já existem na migration inicial. Esta migration só atualiza o RPC.

**Novo retorno:**

```sql
RETURN jsonb_build_object(
  'queue_count',          <contagem de 'waiting'>,
  'user_position',        <posição se 'waiting', null caso contrário>,
  'user_in_queue',        <true se status = 'waiting'>,
  'user_is_promoted',     <true se status = 'promoted'>,
  'promotion_expires_at', <promotion_expires_at se promoted, null caso contrário>
);
```

A query do usuário autenticado deve buscar a entrada com `status IN ('waiting', 'promoted')` para capturar ambos os estados. A `promotion_expires_at` é a coluna existente na tabela `product_queue`.

Exemplo de implementação SQL completo:

```sql
CREATE OR REPLACE FUNCTION public.get_queue_info(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_queue_count integer;
  v_user_position integer;
  v_user_in_queue boolean := false;
  v_user_is_promoted boolean := false;
  v_promotion_expires_at timestamptz;
  v_user_entry record;
BEGIN
  -- Count waiting users
  SELECT COUNT(*) INTO v_queue_count
  FROM product_queue
  WHERE product_id = p_product_id AND status = 'waiting';

  -- Check authenticated user's entry (waiting OR promoted)
  IF auth.uid() IS NOT NULL THEN
    SELECT position, status, promotion_expires_at
    INTO v_user_entry
    FROM product_queue
    WHERE product_id = p_product_id
      AND user_id = auth.uid()
      AND status IN ('waiting', 'promoted')
    LIMIT 1;

    IF FOUND THEN
      IF v_user_entry.status = 'waiting' THEN
        v_user_in_queue := true;
        v_user_position := v_user_entry.position;
      ELSIF v_user_entry.status = 'promoted' THEN
        v_user_is_promoted := true;
        v_promotion_expires_at := v_user_entry.promotion_expires_at;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'queue_count',          v_queue_count,
    'user_position',        v_user_position,
    'user_in_queue',        v_user_in_queue,
    'user_is_promoted',     v_user_is_promoted,
    'promotion_expires_at', v_promotion_expires_at
  );
END;
$$;
```

---

### 2. Hook: `useProductQueue`

**Arquivo:** `src/hooks/useProductQueue.ts`

Adicionar ao retorno do hook os novos campos vindos do RPC:

```typescript
// Campos adicionados ao retorno de useProductQueue
userIsPromoted: boolean;           // true se status='promoted'
promotionExpiresAt: string | null; // ISO timestamp, null se não promovido
minutesRemaining: number | null;   // minutos restantes calculados do timestamp
```

O hook já chama `get_queue_info` via RPC — basta mapear os novos campos do response.

**Estado derivado `minutesRemaining` calculado no hook:**
```typescript
const minutesRemaining = promotionExpiresAt
  ? Math.max(0, Math.floor((new Date(promotionExpiresAt).getTime() - Date.now()) / 60000))
  : null;
```

**Adicionar `refetchInterval` quando produto está reservado** para manter o countdown atualizado sem usar `setInterval`:

```typescript
// Dentro da query config do useProductQueue
refetchInterval: productStatus === 'reserved' ? 30_000 : false,
```

Isso garante que o banner de promoção atualize automaticamente a cada 30s sem polling manual.

---

### 3. ProductDetail — estado promovido

**Arquivo:** `src/pages/ProductDetail.tsx`

Quando `userIsPromoted === true`, substituir a UI de fila atual (botões "Entrar na fila" / "Sair da fila") por um banner de promoção:

**Lógica de exibição:**

```
Se produto.status === 'reserved':
  Se userIsPromoted:
    → Mostrar banner verde de promoção (Seção 3a)
  Senão se userInQueue:
    → Mostrar "Você está na posição #N · Sair da fila" (comportamento atual)
  Senão:
    → Mostrar botão "Entrar na fila" (comportamento atual)
```

#### 3a. Banner de promoção

```tsx
<div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4">
  <div className="flex items-center gap-2 mb-2">
    <span className="text-lg">🎉</span>
    <p className="font-semibold text-emerald-700 dark:text-emerald-400">
      Sua vez chegou!
    </p>
  </div>
  <p className="text-sm text-emerald-600/80 dark:text-emerald-500/80 mb-3">
    Você tem {minutesRemaining} min para finalizar a compra.
  </p>
  <Button
    className="w-full btn-primary"
    onClick={handleBuyNow}
  >
    Comprar agora
  </Button>
</div>
```

**`handleBuyNow`:** O `ProductDetail` não tem uma função nomeada para a compra — a ação é um `onClick` inline no botão "Comprar" existente. O implementador deve extrair esse `onClick` inline para uma função `handleBuyNow` e reutilizá-la no botão "Comprar agora". O fluxo é idêntico ao botão "Comprar" atual: adiciona o produto ao carrinho e navega para `/checkout` (sem query params — o `seller` é derivado do carrinho).

**Quando `minutesRemaining === 0`:** não remover o banner imediatamente (evitar flicker) — o `refetchInterval` do hook vai atualizar o estado quando o cleanup rodar no banco.

**Checkout:** o `reserve_product_for_checkout` RPC já permite que usuários com `status='promoted'` reservem produtos em `reserved` status — nenhuma mudança necessária no Checkout.

---

### 4. QueueViewSheet — promovido no topo + botão manual

**Arquivo:** `src/components/seller/QueueViewSheet.tsx`

O componente existente usa `useEffect`/`useState` para buscar a lista de espera. Manter esse padrão para a lista existente. Adicionar uma segunda query independente (também via `useEffect`/`useState`, seguindo o mesmo padrão do componente) para buscar o usuário promovido.

#### 4a. Buscar usuário promovido

Adicionar state e effect para o entry promovido:

```typescript
const [promotedEntry, setPromotedEntry] = useState(null);

useEffect(() => {
  if (!productId || !open) return;

  supabase
    .from('product_queue')
    .select('id, promotion_expires_at, profiles:user_id(display_name, avatar_url)')
    .eq('product_id', productId)
    .eq('status', 'promoted')
    .maybeSingle()
    .then(({ data }) => setPromotedEntry(data));
}, [productId, open]);
```

#### 4b. Layout atualizado

```
┌─────────────────────────────────────┐
│  Fila de espera                     │
│                                     │
│  [PROMOVIDO AGORA — se houver]      │
│  Avatar  Nome  badge "Promovido"    │
│          "Expira em 22 min"         │
│                                     │
│  [BOTÃO "Promover próximo"]         │
│  Aparece apenas quando:             │
│  - users.length > 0 (há waiting)    │
│  - E promotedEntry é null           │
│                                     │
│  Aguardando (N)                     │
│  #1  Avatar  Nome                   │
│  #2  Avatar  Nome                   │
└─────────────────────────────────────┘
```

#### 4c. Botão "Promover próximo"

```typescript
const handlePromoteNext = async () => {
  const { error } = await supabase.rpc('promote_next_in_queue', {
    p_product_id: productId,
  });
  if (error) {
    toast({ title: 'Erro ao promover usuário', variant: 'destructive' });
  } else {
    toast({ title: 'Próximo usuário promovido!' });
    // re-fetch promoted entry and waiting list
  }
};
```

**Condição de exibição do botão** (onde `users` é o state existente da lista de espera):
```typescript
const showPromoteButton = users.length > 0 && !promotedEntry;
```

**Minutes remaining para o promoted entry** (calcular inline no JSX):
```typescript
const promotedMinutes = promotedEntry?.promotion_expires_at
  ? Math.max(0, Math.floor((new Date(promotedEntry.promotion_expires_at).getTime() - Date.now()) / 60000))
  : 0;
```

---

## Fluxo Completo

```
1. Comprador entra na fila (produto reserved)
   ↓ join_product_queue RPC

2. Ordem do comprador atual é cancelada
   ↓ trigger on_order_cancelled_promote_queue → promote_next_in_queue
   ↓ notificação queue_promotion enviada

3. Comprador promovido vê notificação → navega para /product/:id
   ↓ get_queue_info retorna user_is_promoted=true, promotion_expires_at=...

4. ProductDetail mostra banner verde "Sua vez! X min" + "Comprar agora"
   ↓ Comprador clica "Comprar agora"

5. Fluxo normal de checkout
   ↓ reserve_product_for_checkout (permite promovido reservar produto reserved)
   ↓ Ordem criada → redirect para /chat/:conversationId

6. Vendedor vê banner âmbar no chat → confirma

7. Se comprador promovido não comprar em 30 min:
   ↓ cleanup_expired_reservations → promotion expired → promote_next_in_queue
```

---

## Restrições

- O botão "Comprar agora" usa exatamente o mesmo fluxo do botão "Comprar" normal — nenhuma lógica especial no Checkout para promoção (o RPC já trata isso).
- O countdown não precisa ser em tempo real — usar `refetchInterval: 30_000` no hook. Não usar `setInterval`.
- O `promote_next_in_queue` RPC não tem verificação de dono do produto — o botão no `QueueViewSheet` só é renderizado para o vendedor (garantido pela tela que o contém, `MyListings`).
- Não implementar notificação de "promoção quase expirando" — fora do escopo.
- **Não criar novas RLS policies** — as policies `"Users can view own queue entries"` e `"Sellers can view queue for own products"` já existem na migration inicial.
