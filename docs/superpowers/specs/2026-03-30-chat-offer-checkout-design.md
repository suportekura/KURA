# Chat — Correções de Comportamento e Checkout de Oferta

**Data:** 2026-03-30
**Status:** Aprovado

---

## Contexto

O chat (`/chat/:conversationId`) possui dois cenários de uso:

- **Cenário 1 (pós-compra):** Comprador clicou em "Comprar" no anúncio → ordem gerada → redirecionado ao chat para combinar entrega com vendedor.
- **Cenário 2 (negociação):** Comprador clicou no ícone de chat no anúncio → sem ordem → pode fazer ofertas e negociar preço.

Foram identificados três problemas e um comportamento faltante:

1. O botão "Oferta" aparece mesmo quando já existe uma ordem (Cenário 1), onde não há nada a negociar.
2. O botão "Confirmar" aparece duplicado no header E no banner âmbar para o vendedor.
3. Após uma oferta ser aceita (Cenário 2), não existe link/botão para o comprador finalizar a compra pelo preço negociado.

---

## Escopo

### Arquivos modificados

| Arquivo | Tipo de mudança |
|---|---|
| `src/pages/Chat.tsx` | Bug fix + novo comportamento |
| `src/pages/Checkout.tsx` | Novo modo oferta |

---

## Notas de contexto do código existente

- A tabela `offers` NÃO tem coluna `receiver_id` no schema real (não está nos tipos auto-gerados do Supabase). O hook `useOffers.ts` tenta filtrar por `receiver_id.eq.${user.id}` mas essa coluna não existe — é um bug pré-existente que deve ser anotado mas não é escopo desta tarefa corrigir. O Checkout no modo oferta usa apenas `sender_id = user.id` (o comprador é sempre o remetente da oferta), o que é seguro.
- O guard de redirect em `Checkout.tsx` aparece em **dois lugares**: no `useEffect` (linha ~387) e num guard síncrono de render (linha ~392: `if (...) return null`). Ambos devem ser atualizados.

---

## Design Detalhado

### 1. Remover botão "Oferta" quando existe ordem

**Arquivo:** `src/pages/Chat.tsx`

**Mudança:** Adicionar `!orderSummary` à condição `canMakeOffer`.

```typescript
// Antes
const canMakeOffer = conversation.product_id &&
  conversation.product_price &&
  !conversation.is_seller &&
  !hasAcceptedOffer();

// Depois
const canMakeOffer = conversation.product_id &&
  conversation.product_price &&
  !conversation.is_seller &&
  !hasAcceptedOffer() &&
  !orderSummary;
```

**Regra:** Se `orderSummary` não é nulo, o produto já foi comprado. Não há nada a negociar.

---

### 2. Remover botão "Confirmar" duplicado do header

**Arquivo:** `src/pages/Chat.tsx`

**Mudança:** Remover o bloco JSX do header que renderiza o botão verde "Confirmar" quando `conversation.is_seller && pendingOrderId`.

O banner âmbar logo abaixo do header já contém um botão "Confirmar" com visual adequado (laranja). Manter apenas este.

---

### 3. Link de checkout para oferta aceita

#### 3a. Banner de oferta aceita em `Chat.tsx`

Calcular `acceptedOffer` usando o último aceito (ordena por `created_at` implicitamente via `offers` já ordenado ascendente, usa `findLast` ou filtra e pega o último item):

```typescript
// findLast retorna o último match — protege contra múltiplas rows 'accepted' por bug de DB
const acceptedOffer = [...offers].reverse().find(o => o.status === 'accepted') ?? null;
```

Substituir o banner atual de "✓ Oferta aceita!" por lógica condicional:

- **Para o comprador** (`!conversation.is_seller && acceptedOffer && !orderSummary`): exibir banner verde com o preço aceito e botão **"Comprar por R$ X,XX"**.
  - Navega para: `/checkout?offerId=<acceptedOffer.id>` (sem `?seller=` — o `seller_id` é derivado do produto no banco, não do param da URL)
- **Para o vendedor** (`conversation.is_seller && acceptedOffer && !orderSummary`): exibir apenas "✓ Oferta aceita! Aguardando o comprador finalizar."
- **Se já existe ordem** (`orderSummary`): não exibir este banner para nenhum dos lados (a ordem já foi criada).

#### 3b. Modo oferta em `Checkout.tsx`

Quando `offerId` está presente nos search params (`useSearchParams`), o checkout entra em **modo oferta**.

**Inicialização (useEffect ao montar, apenas quando `offerId` presente):**

```
1. Ler offerId dos search params
2. Buscar no banco:
   SELECT id, amount, status, sender_id, product_id FROM offers
   JOIN products (id, title, images, price, size, brand, seller_id)
   Filtros: id = offerId AND sender_id = user.id AND status = 'accepted'
3. Se não encontrar → toast("Oferta não encontrada ou não está mais disponível") → navigate('/messages')
4. Buscar perfil do vendedor:
   SELECT display_name, avatar_url FROM public_profiles WHERE user_id = products.seller_id
5. Armazenar em estado: offerData { offerId, amount, product { id, title, images, price, size, brand, seller_id }, sellerName, sellerAvatar }
```

**seller_id para criação da ordem:** usar `offerData.product.seller_id` (coluna na tabela `products`), não um campo do perfil.

**Exibição no modo oferta:**

- Header: "Finalizar Compra"
- Produto único: imagem, título, preço original riscado (`offer.product.price`), preço da oferta em destaque (`offer.amount`)
- Seleção de entrega: igual ao modo normal (pickup / local_delivery)
- Campo de observações: igual ao modo normal
- Seção de cupom: **não exibir** (oferta é o desconto)
- Total: `offer.amount`

**Param `?seller=` não é incluído na URL de oferta.** O `seller_id` é derivado de `offerData.product.seller_id` ao buscar a oferta no banco. O param `seller` não é lido ou necessário no modo oferta. Isso evita ambiguidade sobre qual fonte é autoritativa para o ID do vendedor.

**Guard de redirect:** Em modo oferta (`offerId` presente e `sellerId` nulo), bypassar o guard que redireciona para `/cart`. O guard aparece em DOIS lugares em `Checkout.tsx` — ambos devem ser atualizados:

```typescript
// useEffect guard (linha ~387)
// Antes
if (!sellerId || !sellerGroup || sellerItems.length === 0) {
  navigate('/cart');
}
// Depois
if (!offerId && (!sellerId || !sellerGroup || sellerItems.length === 0)) {
  navigate('/cart');
}

// Render guard síncrono (linha ~392)
// Antes
if (!sellerId || !sellerGroup || sellerItems.length === 0) return null;
// Depois
if (!offerId && (!sellerId || !sellerGroup || sellerItems.length === 0)) return null;
```

**Fluxo de confirmação no modo oferta (`handleConfirmOfferOrder`):**

```
1. Reservar produto via RPC reserve_product_for_checkout({ product_ids: [offerData.product.id], buyer_id: user.id })
   → Verificar reservationResults para entradas com success: false
   → Se falha: toast de produto indisponível → navigate('/messages')

2. Criar order (dentro de try/catch com rollback):
   - buyer_id: user.id
   - seller_id: offerData.product.seller_id  ← vem do produto, não do perfil
   - product_id: offerData.product.id
   - status: 'pending'
   - total_price: offerData.amount  ← preço da oferta, lido do banco
   - delivery_method: selectedDelivery
   - delivery_notes: deliveryNotes || null

3. Criar order_items (produto único):
   - title: offerData.product.title
   - price: offerData.amount  ← preço da oferta
   - size: offerData.product.size
   - brand: offerData.product.brand
   - image: offerData.product.images[0] || null

4. Encontrar conversa existente:
   SELECT id FROM conversations
   WHERE product_id = offerData.product.id
   AND (participant_1 = user.id OR participant_2 = user.id)
   LIMIT 1
   → Se não encontrar: toast de aviso ("Pedido criado! Acesse 'Minhas Compras' para acompanhar.") → navigate('/my-purchases')

5. Enviar mensagem automática na conversa:
   "🎉 Pedido confirmado! Oferta aceita. Podemos combinar o local e horário para a entrega?"

6. Toast("Pedido confirmado! 🎉")

7. Navegar para /chat/:conversationId
```

**Rollback em caso de erro na criação da ordem:** Chamar RPC `release_product_reservations({ product_ids: [offerData.product.id] })`.

---

## Fluxo Completo — Cenário 2 (Oferta)

```
Comprador abre chat (sem ordem)
→ Clica em "Oferta"
→ Envia oferta por R$ 40 (produto R$ 50)
→ Vendedor vê OfferCard → clica "Aceitar"
→ Comprador vê banner verde: "✓ Oferta aceita por R$ 40,00 — [Comprar por R$ 40,00]"
→ Clica no botão → navega para /checkout?offerId=Y
→ Checkout modo oferta: mostra produto com R$ 50,00 riscado, R$ 40,00 em destaque
→ Seleciona entrega → Confirmar Pedido
→ Reserva produto via RPC → verifica sucesso
→ Ordem criada com total_price = 40.00 e seller_id = offerData.product.seller_id
→ Busca conversa existente → envia auto-mensagem
→ Redireciona de volta ao /chat/:conversationId
→ Vendedor vê banner âmbar "Pedido aguardando confirmação" → confirma
```

---

## Restrições

- O preço da oferta (`offer.amount`) é lido do banco no checkout, nunca do cliente — impede manipulação.
- A oferta deve ter `sender_id = user.id` e `status = 'accepted'` para ser válida no checkout.
- O produto já existente no carrinho (se houver) não é afetado pelo fluxo de oferta.
- Não criar nova conversa no modo oferta em circunstâncias normais — a conversa onde a oferta ocorreu já existe. Se por algum motivo não encontrar a conversa, redirecionar para `/my-purchases` com aviso.
- O `seller_id` para a ordem vem de `offerData.product.seller_id` (coluna DB), não de dados do perfil.
