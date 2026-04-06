# Auditoria KuraLab — Resultado

**Data:** 2026-03-21
**Spec:** `docs/superpowers/specs/2026-03-21-auditoria-kuralab-design.md`
**Plano:** `docs/superpowers/plans/2026-03-21-auditoria-kuralab.md`

---

## Fase 1 — Achados por Trilha

### Trilha 1 — Código Morto & Imports

| Achado | Severidade | Status |
|--------|-----------|--------|
| Array `mockProducts[]` exportado mas nunca importado em produção | MEDIUM | ✅ Corrigido |
| Tipos legados `SizeCategory`, `sizeCategoryMap`, `sizesByCategory` sem consumidores | LOW | ✅ Corrigido |
| `AnimatedPage.tsx` e `AnimatedList.tsx` exportados mas nunca usados | LOW | ✅ Corrigido |
| Todos os outros arquivos suspeitos (SoldOverlay, PublicProfileInfoDialog, etc.) | — | ✅ Confirmados em uso |

**Nota:** Nenhum dado mock estava chegando ao usuário em produção. Os 4 arquivos que importavam `mockProducts.ts` usavam apenas constantes de configuração legítimas (categorias, tamanhos).

---

### Trilha 2 — Bugs & Lógica Inconsistente

| Achado | Severidade | Status |
|--------|-----------|--------|
| `TermsOfUse.tsx` era duplicata de `Terms.tsx` — Auth.tsx apontava para versão incompleta | MEDIUM | ✅ Corrigido |
| `useAuth.tsx` tinha ~12 `console.log` incluindo vazamento de emails e status de suspensão | MEDIUM | ✅ Corrigido |
| `CreditCardPaymentModal` não resetava estado de erro ao reabrir | MEDIUM | ✅ Corrigido |
| `MyPurchases.tsx` botão "Voltar" navegava para `/` em vez de `navigate(-1)` | LOW | ✅ Corrigido |
| Botão CTA "Explorar peças" em MyPurchases estava usando `navigate(-1)` erroneamente | LOW | ✅ Corrigido |
| `Dashboard.tsx` engolia erros silenciosamente (sem toast em caso de falha) | MEDIUM | ✅ Corrigido |
| `Checkout.tsx` pedidos multi-item só salva primeiro `product_id` no FK | MEDIUM | ✅ Documentado (limitação de schema, não bug de código) |
| `/cart` sem `ProtectedRoute` enquanto `/checkout` tem | LOW | ✅ Confirmado intencional (guest cart UX) |
| `useGeolocation` tem `setTimeout` sem cleanup | LOW | Pendente (baixo risco) |
| `useProductQueue` não expõe estado de erro ao caller | LOW | Pendente (baixo risco) |

---

### Trilha 3 — Segurança & Supabase

| Achado | Severidade | Status |
|--------|-----------|--------|
| `useOffers.ts` query sem filtro de participante — qualquer usuário podia ler ofertas alheias | CRITICAL | ✅ Corrigido |
| `useOffers.ts` `respondToOffer` sem verificação de propriedade — qualquer usuário podia aceitar/rejeitar ofertas | CRITICAL | ✅ Corrigido |
| `Chat.tsx` busca de conversa sem filtro de participante | CRITICAL | ✅ Corrigido |
| `AdminRoute` é gate client-side apenas — RPCs admin podem não ter verificação server-side | HIGH | ⚠️ Pendente (requer auditoria do banco de dados) |
| Coupon `use_count` com race condition TOCTOU | MEDIUM | ✅ Corrigido (optimistic lock) |
| `EditAddress.tsx` update sem re-confirmação de `user_id` | MEDIUM | ✅ Corrigido |
| `PixPaymentModal.tsx` polling de pagamento sem filtro `user_id` | MEDIUM | ✅ Corrigido |
| `Sell.tsx` edge functions de moderação chamadas com anon key (sem JWT) | MEDIUM | ✅ Corrigido |
| `Checkout.tsx` incremento de cupom não é revertido junto com o pedido em caso de falha | MEDIUM | ✅ Corrigido (error check no lock) |
| Coupon lookup expõe `user_id` do vendedor (information disclosure) | LOW | Pendente (baixo risco) |
| `record_product_view` deduplication depende de lógica no banco não auditada | MEDIUM | ⚠️ Pendente (requer auditoria do banco de dados) |
| Edge function `get-vapid-key` pode não exigir autenticação | LOW | ✅ Corrigido (auth guard adicionado) |
| `useConversation` não valida se participante existe ou está suspenso | LOW | Pendente (baixo risco) |

---

### Trilha 4 — UI & Funcionalidades Incompletas

| Achado | Severidade | Status |
|--------|-----------|--------|
| Install PWA | — | ✅ Funcional e completo |
| Coupons → Checkout | — | ✅ Integração completa |
| PremiumMetrics | — | ✅ Dados reais, corretamente protegido |
| `Following.tsx` empty state sem ícone ou layout centralizado | LOW | ✅ Corrigido |
| `CreditCardPaymentModal` fechava sem tela de confirmação de sucesso | MEDIUM | ✅ Corrigido |
| `Boosts.tsx` não desabilitava botão quando créditos = 0 | LOW | ✅ Corrigido |
| `PullToRefresh` implementado mas só em 2 páginas | LOW | ✅ Corrigido (adicionado a Messages e Notifications) |
| Seller components | — | ✅ Todos em uso |
| Empty states em pages principais | — | ✅ Todas têm empty states adequados |
| Textos em inglês na UI | — | ✅ Nenhum encontrado |

---

## Fase 2 — Correções Aplicadas

### Commits gerados nesta auditoria

| Commit | Descrição |
|--------|-----------|
| `4493aea` | fix: security — add user scope filters, fix anon key edge function calls, add optimistic lock on coupon |
| `52f2e08` | fix: address code review issues — optimistic lock error check, user guards in offers and payment polling |
| `a93f7ee` | fix: add user?.id to PixPaymentModal polling effect dependency array |
| `8c6beb9` | fix: remove duplicate TermsOfUse page, fix back navigation, surface dashboard errors, reset payment modal error state |
| `b5585a7` | fix: restore marketplace navigation for 'Explorar pecas' CTA in MyPurchases empty state |
| `0f4539a` | chore: remove dead code, unused animations, mock data array and debug console.logs |
| `0ff56a1` | chore: remove remaining debug console.log in useAuth signOut |
| `f150e9c` | fix: improve empty states, add payment success screen, disable boost button on zero credits, add pull-to-refresh to messages and notifications |
| `834c1ad` | fix: remove stale onOpenChange dep from CreditCardModal, stabilize notifications PTR callback |

**Total: 9 commits, ~25 arquivos modificados**

---

## Pendências — Decisões que requerem input

### 1. AdminRoute — ✅ Confirmado seguro (auditado nas migrations)

As funções RPC admin já possuem `IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Unauthorized'` em todas as funções admin. Nenhuma ação necessária.

### 2. record_product_view — ✅ Confirmado seguro (auditado nas migrations)

A função já implementa deduplicação de 30 min por `(product_id, viewer_id)` com verificação explícita antes do INSERT. Nenhuma ação necessária.

### 3. Coupon use_count — ✅ Resolvido com RPC atômico

Migration `20260321000001_increment_coupon_use_count.sql` criada com UPDATE atômico + REVOKE PUBLIC. Checkout.tsx atualizado para usar o RPC.

### 4. Checkout — multi-item orders e product_id FK (INFORMATIVO)

A tabela `orders` tem FK `product_id` que armazena apenas o primeiro produto. Todos os itens estão em `order_items`. Limitação arquitetural documentada no código. Sem ação necessária agora.

### 5. useGeolocation — ✅ Resolvido

`clearTimeout` adicionado como cleanup.

### 6. get-vapid-key — ✅ Resolvido

Auth guard (Bearer token check) adicionado à edge function.

### 7. useConversation — ✅ Resolvido

Usuários suspensos não podem receber mensagens. Check adicionado em `useConversation.ts` — consulta `profiles.suspended_at` do destinatário antes de criar/abrir conversa. Se suspenso, exibe toast "Usuário indisponível" e bloqueia a navegação.
