# KuraLab — Auditoria Completa: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auditar e corrigir o codebase KuraLab identificando código morto, bugs, inconsistências lógicas, problemas de segurança e funcionalidades incompletas.

**Architecture:** Fase 1 — 4 subagentes de descoberta em paralelo, cada um inspecionando uma trilha independente e produzindo uma lista de achados. Fase 2 — execução sequencial das correções por prioridade (Crítico → Alto → Médio → Baixo). Sem testes automatizados; verificação via `bun run build` após cada grupo de correções.

**Tech Stack:** React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui + Supabase + framer-motion + Asaas payments

---

## Contexto Importante

- Projeto: marketplace de moda circular brasileiro (KuraLab)
- Sem testes automatizados — verificar com `bun run build` após correções
- Backend: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- Pagamentos: Asaas (PIX + cartão de crédito)
- Distribuição: PWA via Vercel
- `mockProducts` ainda está em uso em produção em: `CategorySlider.tsx`, `FilterSheet.tsx`, `Search.tsx`, `Sell.tsx`
- Tipos legados (`SizeCategory`, `sizeCategoryMap`, `sizesByCategory`) existem apenas em `src/data/mockProducts.ts` — sem uso externo
- Spec em: `docs/superpowers/specs/2026-03-21-auditoria-kuralab-design.md`

---

## Fase 1 — Descoberta (Tasks 1-4 rodam em paralelo)

---

### Task 1: Trilha — Código Morto & Imports

**Files a inspecionar:**
- Todos os arquivos em `src/` recursivamente
- Foco especial: `src/data/mockProducts.ts`, `src/lib/animations.ts`, `src/components/animations/`

- [ ] **Step 1: Auditar imports não utilizados**

Buscar em todos os `.tsx`/`.ts`:
```bash
# Rodar ESLint para detectar unused imports
bun run lint 2>&1 | grep "no-unused"
```
Documentar cada arquivo com imports não utilizados.

- [ ] **Step 2: Auditar uso de mockProducts**

Verificar cada arquivo que importa `mockProducts`:
- `src/components/products/CategorySlider.tsx` — o que usa exatamente?
- `src/components/products/FilterSheet.tsx` — o que usa exatamente?
- `src/pages/Search.tsx` — usa mock ou dados reais do Supabase?
- `src/pages/Sell.tsx` — usa mock ou dados reais?

Documentar: qual dado mock ainda está sendo exibido para o usuário em produção.

- [ ] **Step 3: Auditar tipos legados em mockProducts.ts**

Verificar linhas 252-262 de `src/data/mockProducts.ts`:
```
SizeCategory, sizeCategoryMap, sizesByCategory
```
Confirmar que não são importados fora de `mockProducts.ts`.
Marcar como candidatos à remoção.

- [ ] **Step 4: Auditar src/lib/animations.ts**

Verificar se `src/lib/animations.ts` é importado por algo além de `src/components/animations/index.ts`.
Verificar se `src/components/animations/AnimatedList.tsx` e `AnimatedPage.tsx` são usados.

- [ ] **Step 5: Auditar componentes exportados mas nunca importados**

Verificar os seguintes arquivos — se são exportados mas não importados em lugar nenhum:
- `src/components/cart/SoldOverlay.tsx`
- `src/components/profile/PublicProfileInfoDialog.tsx`
- `src/components/seller/FollowersList.tsx`
- `src/components/dashboard/SharedComponents.tsx`
- `src/lib/documentValidation.ts`
- `src/lib/transformProduct.ts`
- `src/lib/validations.ts`

- [ ] **Step 6: Documentar todos os achados da Trilha 1**

Criar lista com:
- Arquivo → problema → severidade (remover / substituir / manter)

---

### Task 2: Trilha — Bugs & Lógica Inconsistente

**Files a inspecionar:**
- `src/hooks/` (todos os 20 hooks)
- `src/pages/Terms.tsx`, `src/pages/TermsOfUse.tsx`
- `src/pages/Dashboard.tsx`, `src/pages/MySales.tsx`, `src/pages/MyPurchases.tsx`
- `src/App.tsx` (rotas e proteção)
- `src/contexts/CartContext.tsx`

- [ ] **Step 1: Auditar Terms vs TermsOfUse**

Ler `src/pages/Terms.tsx` e `src/pages/TermsOfUse.tsx`.
Verificar se são a mesma página, páginas complementares ou com propósitos diferentes.
Verificar qual rota é linkada na navegação (`/terms` vs `/terms-of-use`).

- [ ] **Step 2: Auditar Cart sem ProtectedRoute**

Em `src/App.tsx` linha 100:
```tsx
<Route path="/cart" element={<Cart />} />
```
Verificar se isso é intencional (carrinho público para SEO) ou bug.
Verificar o que acontece no `Checkout` quando o usuário não está logado mas tem itens no carrinho.

- [ ] **Step 3: Auditar Dashboard vs MySales/MyPurchases**

Ler `src/pages/Dashboard.tsx` e verificar se `SalesTab`/`PurchasesTab` duplicam a lógica de `src/pages/MySales.tsx` e `src/pages/MyPurchases.tsx`.
Verificar se ambas as rotas (`/dashboard` e `/my-sales`) são necessárias ou se uma delas é legacy.

- [ ] **Step 4: Auditar hooks com useEffect suspeitos**

Inspecionar os seguintes hooks em busca de dependências incorretas:
- `src/hooks/useProducts.ts`
- `src/hooks/useInfiniteProducts.ts`
- `src/hooks/useProductQueue.ts`
- `src/hooks/useGeolocation.tsx`
- `src/hooks/useNotifications.ts`

Procurar por: `useEffect(() => {...}, [])` que deveria ter dependências, ou dependências faltando que causam stale closures.

- [ ] **Step 5: Auditar estados não resetados**

Inspecionar os seguintes componentes em busca de estados que nunca resetam ao fechar/abrir:
- `src/components/boost/BoostSelectionModal.tsx`
- `src/components/boost/CreditCardPaymentModal.tsx`
- `src/components/boost/PixPaymentModal.tsx`
- `src/components/chat/OfferSheet.tsx`
- `src/components/location/LocationUpdateSheet.tsx`

Verificar se ao reabrir um modal/sheet o estado anterior persiste indevidamente.

- [ ] **Step 6: Auditar console.logs em produção**

Os seguintes arquivos têm `console.log`/`console.error`/`console.warn` — verificar quais são debug temporários vs erros legítimos que deveriam virar toast/tratamento de erro:
- `src/hooks/useAuth.tsx`
- `src/hooks/useGeolocation.tsx`
- `src/hooks/useProductQueue.ts`
- `src/pages/Checkout.tsx`
- `src/pages/Chat.tsx`

- [ ] **Step 7: Documentar todos os achados da Trilha 2**

---

### Task 3: Trilha — Segurança & Supabase

**Files a inspecionar:**
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts` (schema completo)
- Todos os hooks que fazem queries: `useProducts`, `useUserProfile`, `useAdmin`, `useOffers`, etc.
- `.env.example`

- [ ] **Step 1: Auditar variáveis de ambiente expostas**

Ler `.env.example` e verificar quais variáveis são usadas no client-side (`VITE_` prefix).
Verificar `src/integrations/supabase/client.ts` — confirmar que apenas a `anon key` está exposta, nunca a `service_role key`.

- [ ] **Step 2: Auditar queries sem filtro de user_id**

Inspecionar os seguintes hooks em busca de queries que buscam dados sem filtrar por `user_id` quando deveriam:
- `src/hooks/useUserProfile.ts` — busca perfil de outros usuários? Correto ou vazamento?
- `src/hooks/useAdmin.ts` — as queries admin têm proteção além do RLS?
- `src/hooks/useOffers.ts` — ofertas filtradas corretamente por participante?
- `src/hooks/useConversation.ts` — mensagens filtradas pelos dois participantes?
- `src/hooks/useNotifications.ts` — notificações filtradas por user_id?

- [ ] **Step 3: Auditar tabelas sensíveis**

Verificar no schema (`types.ts`) as seguintes tabelas e confirmar que as queries as respeitam:
- `addresses` — somente o próprio usuário deve ler/escrever
- `asaas_customers` — dados de pagamento, isolamento crítico
- `boost_payments` — dados financeiros, isolamento crítico
- `coupons` — usuário só deve ver seus próprios cupons

- [ ] **Step 4: Auditar rotas admin**

Verificar `src/components/auth/AdminRoute.tsx`:
- A verificação de admin é feita no client-side apenas ou também no servidor?
- Se apenas client-side, um usuário que manipula o estado local consegue acessar `/admin`?

Verificar `src/hooks/useUserRoles.ts` — como os roles são determinados?

- [ ] **Step 5: Auditar useProductViews**

Ler `src/hooks/useProductViews.ts` — views de produtos são registradas anonimamente?
Isso pode permitir spam de views artificiais?

- [ ] **Step 6: Documentar todos os achados da Trilha 3**

---

### Task 4: Trilha — UI & Funcionalidades Incompletas

**Files a inspecionar:**
- `src/pages/Install.tsx`
- `src/pages/Coupons.tsx`
- `src/pages/Checkout.tsx`
- `src/components/dashboard/PremiumMetricsSection.tsx`
- `src/components/seller/` (todos)
- `src/components/PullToRefreshIndicator.tsx` + `src/hooks/usePullToRefresh.ts`

- [ ] **Step 1: Auditar página Install (PWA)**

Ler `src/pages/Install.tsx`.
Verificar se o fluxo de instalação PWA está funcional: detecção de `beforeinstallprompt`, fallback para iOS, instruções de instalação.
Verificar se `public/sw-push.js` está configurado corretamente.

- [ ] **Step 2: Auditar Coupons integrado ao Checkout**

Ler `src/pages/Coupons.tsx` e `src/pages/Checkout.tsx`.
Verificar se um cupom criado em `/profile/coupons` pode ser aplicado no checkout.
Verificar se a lógica de desconto (percentual vs fixo, por produto vs geral) está implementada no checkout.

- [ ] **Step 3: Auditar PremiumMetricsSection**

Ler `src/components/dashboard/PremiumMetricsSection.tsx`.
Verificar se as métricas exibidas são dados reais do Supabase ou valores hardcoded/mock.
Verificar se o acesso a métricas premium verifica realmente se o usuário tem plano premium.

- [ ] **Step 4: Auditar PullToRefresh**

Ler `src/components/PullToRefreshIndicator.tsx` e `src/hooks/usePullToRefresh.ts`.
Verificar se é usado em alguma página e se o comportamento está correto (threshold, animação, trigger de refetch).

- [ ] **Step 5: Auditar componentes seller**

Inspecionar `src/components/seller/`:
```bash
ls src/components/seller/
```
Verificar se todos os componentes exportados são realmente usados em alguma página.

- [ ] **Step 6: Auditar estados de loading/empty/error**

Verificar as seguintes páginas — se têm estado vazio e estado de erro adequados:
- `src/pages/Messages.tsx` — sem conversas: exibe o quê?
- `src/pages/Favorites.tsx` — sem favoritos: exibe o quê?
- `src/pages/MyListings.tsx` — sem anúncios: exibe o quê?
- `src/pages/Notifications.tsx` — sem notificações: exibe o quê?

- [ ] **Step 7: Documentar todos os achados da Trilha 4**

---

## Fase 2 — Correções (Tasks 5-8 executam sequencialmente após Task 1-4)

---

### Task 5: Corrigir Problemas Críticos (Segurança)

**Depende de:** Task 3 concluída

**Files:** Baseado nos achados da Trilha 3

- [ ] **Step 1: Corrigir AdminRoute se verificação for apenas client-side**

Se `AdminRoute` não verifica role no servidor, adicionar verificação via Supabase RPC ou query para `user_roles`/`profiles` antes de renderizar.

- [ ] **Step 2: Corrigir queries sem filtro de user_id**

Para cada query identificada na Trilha 3 que expõe dados de outros usuários indevidamente, adicionar `.eq('user_id', user.id)` ou o filtro adequado.

- [ ] **Step 3: Verificar build após correções críticas**

```bash
bun run build
```
Esperado: build sem erros de TypeScript.

- [ ] **Step 4: Commit das correções críticas**

```bash
git add -p
git commit -m "fix: security — restrict queries to authenticated user scope"
```

---

### Task 6: Corrigir Problemas Altos (Bugs Funcionais)

**Depende de:** Task 1, Task 2 concluídas

**Files:** Baseado nos achados das Trilhas 1 e 2

- [ ] **Step 1: Remover uso de mockProducts em produção**

Para cada arquivo que usa `mockProducts` em contexto de produção:
- `src/pages/Search.tsx` — substituir por dados reais do Supabase ou remover fallback mock
- `src/pages/Sell.tsx` — verificar uso e corrigir
- `src/components/products/FilterSheet.tsx` — verificar uso (categorias usam mock ou constantes?)
- `src/components/products/CategorySlider.tsx` — idem

Manter `categories`, `sizesByProductCategory` e helpers em `mockProducts.ts` pois são dados de configuração válidos.
Remover apenas o array `mockProducts[]` dos imports de produção.

- [ ] **Step 2: Resolver Terms vs TermsOfUse**

Baseado no achado da Trilha 2:
- Se forem a mesma página: remover a duplicata, atualizar todos os links para apontar para a versão correta, remover a rota do `App.tsx`
- Se forem complementares: garantir que ambas são linkadas nos lugares certos (footer, signup flow, etc.)

- [ ] **Step 3: Corrigir hooks com useEffect problemáticos**

Para cada `useEffect` com dependências incorretas identificado na Trilha 2, corrigir o array de dependências.
Prestar atenção para não criar loops infinitos ao adicionar dependências — usar `useCallback` onde necessário.

- [ ] **Step 4: Corrigir estados não resetados em modais**

Para cada modal/sheet identificado na Trilha 2 com estado persistente indevido:
- Adicionar reset do estado no `onOpenChange(false)` ou equivalente
- Verificar se o reset deve acontecer ao abrir ou ao fechar

- [ ] **Step 5: Remover console.logs de debug**

Para cada `console.log` identificado na Trilha 2 que é debug temporário:
- Remover silenciosamente se o erro já é tratado de outra forma
- Substituir por `toast.error()` se o usuário deveria ser notificado do erro

- [ ] **Step 6: Verificar build**

```bash
bun run build
```
Esperado: build sem erros.

- [ ] **Step 7: Commit das correções altas**

```bash
git add -p
git commit -m "fix: remove mock data from production, fix duplicate pages and state resets"
```

---

### Task 7: Corrigir Problemas Médios (Limpeza de Código)

**Depende de:** Task 6 concluída

**Files:** Baseado nos achados da Trilha 1

- [ ] **Step 1: Remover tipos legados de mockProducts.ts**

Em `src/data/mockProducts.ts`, remover (linhas ~252-262):
```ts
// Remover:
export type SizeCategory = ...
export const sizeCategoryMap: ...
export const sizesByCategory: ...
```
Confirmar que não há imports externos desses tipos antes de remover.

- [ ] **Step 2: Remover imports não utilizados**

Para cada arquivo com imports não utilizados identificado na Trilha 1:
- Remover o import
- Verificar se o TypeScript ainda compila

Fazer em lotes por diretório (hooks → components → pages).

- [ ] **Step 3: Remover funções/variáveis declaradas e nunca usadas**

Para cada função/variável identificada na Trilha 1 como nunca utilizada:
- Verificar novamente antes de remover (o subagente pode ter errado)
- Remover com cuidado, verificar TypeScript após cada remoção

- [ ] **Step 4: Avaliar e limpar componentes exportados sem uso**

Para cada componente identificado na Trilha 1 como exportado mas nunca importado:
- Se realmente não tem uso: remover o arquivo
- Se pode ser útil no futuro mas não está em uso agora: remover (YAGNI)
- Se é usado via lazy import ou dinâmico: manter

- [ ] **Step 5: Verificar build**

```bash
bun run build
```
Esperado: build sem erros.

- [ ] **Step 6: Commit da limpeza**

```bash
git add -p
git commit -m "chore: remove dead code, unused imports and legacy types"
```

---

### Task 8: Corrigir Problemas Baixos (UI & Completude)

**Depende de:** Task 7 concluída

**Files:** Baseado nos achados da Trilha 4

- [ ] **Step 1: Corrigir/verificar PullToRefresh**

Baseado no achado da Trilha 4:
- Se `usePullToRefresh` não está integrado a nenhuma página, avaliar se deve ser conectado às páginas principais (Index, Messages, Notifications) ou removido
- Se está integrado mas com bug, corrigir

- [ ] **Step 2: Corrigir estados empty nas páginas principais**

Para cada página sem estado vazio adequado identificado na Trilha 4:
- Adicionar componente de empty state consistente com o design do app
- Mensagem em português
- Ação sugerida (ex: "Você ainda não tem favoritos — explore o marketplace")

- [ ] **Step 3: Verificar e corrigir Coupons no Checkout**

Baseado no achado da Trilha 4:
- Se o fluxo de cupom está incompleto no checkout, implementar a parte faltante
- Ou se o fluxo está funcional mas com UI inconsistente, corrigir

- [ ] **Step 4: Corrigir PremiumMetricsSection se usar dados mock**

Se as métricas premium são hardcoded:
- Conectar aos dados reais do Supabase
- Ou adicionar bloqueio claro "Disponível com o plano Premium" se for feature futura

- [ ] **Step 5: Verificar build final**

```bash
bun run build
```
Esperado: build sem erros, sem warnings críticos.

- [ ] **Step 6: Commit final e resumo**

```bash
git add -p
git commit -m "fix: improve empty states, complete ui gaps found in audit"
```

---

### Task 9: Resumo Consolidado da Auditoria

**Depende de:** Todas as tasks anteriores concluídas

- [ ] **Step 1: Escrever resumo dos achados**

Criar `docs/superpowers/specs/2026-03-21-auditoria-resultado.md` com:
- **Trilha 1 — Achados:** lista do que foi encontrado
- **Trilha 2 — Achados:** lista do que foi encontrado
- **Trilha 3 — Achados:** lista do que foi encontrado
- **Trilha 4 — Achados:** lista do que foi encontrado
- **Correções aplicadas:** o que foi corrigido em cada task
- **Pendências:** decisões que requerem input do usuário (ex: remover uma feature inteira, migrar dados no banco, etc.)

- [ ] **Step 2: Commit do resumo**

```bash
git add docs/superpowers/specs/2026-03-21-auditoria-resultado.md
git commit -m "docs: add audit results summary"
```

- [ ] **Step 3: Apresentar resumo ao usuário**

Apresentar os pontos mais críticos encontrados e corrigidos, e as pendências que precisam de decisão.
