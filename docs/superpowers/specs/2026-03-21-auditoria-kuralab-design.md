# Auditoria Completa KuraLab

**Data:** 2026-03-21
**Tipo:** Auditoria — Identificar e corrigir
**Escopo:** Código, banco de dados, segurança e UI

---

## Contexto

KuraLab é um marketplace brasileiro de moda circular (roupas usadas/novas), construído com:
- **Frontend:** React + TypeScript + Vite + TailwindCSS + shadcn/ui + framer-motion
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Distribuição:** PWA via vite-plugin-pwa + Vercel

O projeto possui ~30 páginas, ~60 componentes, ~20 hooks customizados, integração com Supabase (tabelas, RLS, edge functions) e pagamentos via Asaas (PIX + cartão).

---

## Objetivo

Auditoria completa em 2 fases:
1. **Descoberta paralela** em 4 trilhas independentes
2. **Execução das correções** por ordem de prioridade (crítico → baixo)

Sem testes automatizados — correções podem ser aplicadas diretamente.

---

## Fase 1 — Descoberta Paralela (4 trilhas)

### Trilha 1 — Código Morto & Imports
- Imports não utilizados em todos os arquivos `.tsx`/`.ts`
- Variáveis, funções e hooks declarados mas nunca chamados
- `src/data/mockProducts.ts` — verificar se `mockProducts[]` ainda é usado em produção
- Tipos legados (`SizeCategory`, `sizeCategoryMap`, `sizesByCategory`) — verificar uso real
- Arquivos/componentes exportados mas nunca importados em lugar nenhum
- `src/lib/animations.ts` — verificar se é usado além de `src/components/animations/`

### Trilha 2 — Bugs & Lógica Inconsistente
- Hooks com arrays de dependências incorretos em `useEffect`
- Estados que nunca são resetados (modais, forms, filtros)
- Race conditions em chamadas assíncronas ao Supabase
- Páginas com propósito duplicado: `Terms.tsx` vs `TermsOfUse.tsx`
- `Cart` sem `ProtectedRoute` enquanto `Checkout` tem — inconsistência intencional ou bug?
- Tratamento de erros ausente ou genérico demais em hooks principais
- `useProductQueue.ts` — verificar se está implementado e integrado corretamente
- `Dashboard.tsx` com `SalesTab`/`PurchasesTab` vs `MySales.tsx`/`MyPurchases.tsx` — duplicação de funcionalidade?

### Trilha 3 — Segurança & Supabase
- Queries Supabase sem filtro `user_id` onde deveriam ter (vazamento de dados)
- Tabelas sem RLS ativa ou com políticas permissivas demais
- Edge functions sem validação de autenticação
- Dados sensíveis (PIX, telefone, endereço) fetchados desnecessariamente ou expostos
- `userId` passado via URL params ou estado compartilhado publicamente
- `.env.example` — verificar quais variáveis estão expostas no bundle client-side
- `asaas_customers` e `boost_payments` — verificar se as queries respeitam isolamento por usuário

### Trilha 4 — UI & Funcionalidades Incompletas
- Componentes com `TODO`, `FIXME`, textos placeholder ou hardcoded em inglês
- `Install.tsx` — verificar se a página de instalação PWA está funcional
- `Coupons.tsx` — verificar integração completa com o fluxo de checkout
- Estados de loading/empty/error ausentes em listagens e detalhes
- `PremiumMetricsSection.tsx` — verificar se métricas premium estão implementadas ou são mock
- `BoostSelectionModal`, `CreditCardPaymentModal`, `PixPaymentModal` — fluxo completo funcional?
- `AnimatedRoutes`, `AnimatedList` — verificar se causam bugs visuais ou de navegação
- `PullToRefreshIndicator.tsx` — funcionalidade implementada de ponta a ponta?

---

## Fase 2 — Execução por Prioridade

### Crítico — Segurança
- Corrigir queries que expõem dados de outros usuários
- Proteger rotas que deveriam exigir autenticação
- Remover/ofuscar segredos expostos no client-side

### Alto — Bugs Funcionais
- Remover ou substituir uso de `mockProducts` em produção
- Unificar páginas duplicadas (`Terms`/`TermsOfUse`, fluxos de dashboard)
- Corrigir `useEffect` com dependências erradas
- Corrigir estados não resetados em modais/forms críticos

### Médio — Limpeza de Código
- Remover todos os imports não utilizados
- Remover tipos legados sem uso real
- Remover funções/variáveis declaradas e nunca chamadas
- Consolidar componentes com responsabilidade duplicada

### Baixo — UI & Completude
- Adicionar estados de loading/empty/error faltantes
- Corrigir textos hardcoded em inglês
- Verificar e completar funcionalidades incompletas (Install, Coupons, PullToRefresh)

---

## Entregável Final

Após as correções, um resumo consolidado com:
- Achados por trilha (o que foi encontrado)
- Correções aplicadas (o que foi corrigido)
- Pendências (decisões que requerem input do usuário, como remover features inteiras)
