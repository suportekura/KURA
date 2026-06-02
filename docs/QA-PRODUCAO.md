# ✅ Checklist de Revisão Pré-Produção — Kura

> Marketplace de brechó online (kuralab.com.br). Use este checklist antes de cada deploy/merge para `main`.
> Consulte também `VERSIONING.md` para o bump de versão obrigatório.

---

## 1. Autenticação & Cadastro (5 etapas)

- [ ] Signup PF: escolha de tipo → nome/email → OTP → senha → perfil completo (CPF, idade, endereço, PIX opcional)
- [ ] Signup PJ: mesmo fluxo com CNPJ + razão social
- [ ] Envio de OTP via email (`send-verification-code`) chega em < 1 min
- [ ] OTP expira corretamente e código usado não pode ser reutilizado (`verify-code`)
- [ ] Reenvio de OTP respeita rate limit (Upstash) sem travar o usuário legítimo
- [ ] Senha valida regras (mín. 8 chars, letra + dígito) com mensagem PT-BR clara
- [ ] Login email/senha com credenciais corretas e mensagem de erro traduzida (`translateAuthError`) para inválidas
- [ ] Google OAuth: signup novo cria profile via `handle_new_user()` trigger
- [ ] Google OAuth: usuário existente loga sem duplicar profile
- [ ] AuthCallback trata retorno do OAuth e redireciona ao destino certo
- [ ] Reset de senha completo (`reset-password`) com OTP verificado
- [ ] Sessão persiste em localStorage e auto-refresh funciona após token expirar
- [ ] Logout limpa sessão e redireciona

## 2. ProtectedRoute & Guards

- [ ] Usuário sem `email_verified` → redirect para verify-email
- [ ] Usuário sem `profile_completed` → redirect para profile-setup
- [ ] Usuário com `suspended_at` preenchido → bloqueado com mensagem de suspensão
- [ ] Usuário não logado em rota protegida → redirect para `/auth`
- [ ] PublicRoute: usuário logado é redirecionado para fora de `/auth`
- [ ] AdminRoute: usuário sem role admin/moderator é bloqueado
- [ ] Cache de 30s do status de perfil no AuthProvider não causa redirect-loop nem estado stale após completar perfil

## 3. Perfil & Configurações

- [ ] Editar perfil (nome, display_name, avatar, cidade)
- [ ] Upload de avatar funciona e respeita limites de tamanho
- [ ] Settings: telefone, endereço, PIX, senha, loja (shop), suporte
- [ ] CPF/CNPJ/PIX salvos criptografados (AES-256-GCM via `save-user-profile`) — confirmar que nunca aparecem em texto plano no banco/logs
- [ ] Validação CPF/CNPJ rejeita documentos inválidos
- [ ] Deletar conta remove/anonimiza dados conforme LGPD
- [ ] Perfil público (`/seller/:id`) não expõe dados sensíveis (usa `public_profiles`)

## 4. Marketplace & Produtos

- [ ] Index carrega grid com infinite scroll (PAGE_SIZE 12)
- [ ] Todos os produtos vêm via RPC `get_products_with_distance` / `get_product_with_distance` — nenhuma query direta na tabela `products`
- [ ] Coordenadas do vendedor nunca aparecem na resposta da API/network tab
- [ ] Distância calculada corretamente conforme localização do usuário
- [ ] `transformProduct()` mapeia snake_case → camelCase sem campos faltando
- [ ] Criar listing (`/sell`): todas as categorias do enum, condição novo/usado, gênero
- [ ] Editar listing existente
- [ ] Upload de imagens + moderação (`moderate-image`) bloqueia screenshots/NSFW/não-produto
- [ ] Moderação de texto (`moderate-text`) bloqueia profanidade/spam no título/descrição
- [ ] Produto entra em `pending_review` quando necessário e flui para `active` após aprovação
- [ ] Status: draft, active, sold, reserved, inactive — transições corretas
- [ ] View count / `product_views` com dedup de 30 min
- [ ] Produtos de vendedores suspensos não aparecem (RLS)

## 5. Busca & Filtros

- [ ] Busca por texto retorna resultados relevantes
- [ ] FilterSheet: distância, preço (min/max), condição, categoria, gênero
- [ ] Ordenação (`sortOption`) funciona e reflete na query key
- [ ] CategorySlider navega entre categorias
- [ ] Combinação de múltiplos filtros sem quebrar
- [ ] Estado vazio (nenhum resultado) com mensagem PT-BR

## 6. Geolocalização & LGPD

- [ ] Permissão de localização: modal/sheet de location
- [ ] Geolocalização do browser + reverse geocoding (Nominatim) preenche cidade
- [ ] Coordenadas arredondadas a 4 casas decimais (~11m)
- [ ] Guest → localização em localStorage; usuário logado → `user_locations`
- [ ] Negar permissão não quebra o app (fallback gracioso)

## 7. Carrinho & Checkout

- [ ] Adicionar/remover do carrinho persiste em localStorage (`kuralab_cart`)
- [ ] Realtime: produto vendido por outro mostra SoldOverlay no carrinho
- [ ] Produto reservado/indisponível tratado no checkout
- [ ] Checkout: escolha de `delivery_method` (pickup / local_delivery)
- [ ] Cálculo de `total_price` correto (com cupom se aplicável)
- [ ] Ordem criada em `orders` + snapshot em `order_items`

## 8. Pagamentos (Pagar.me) — CRÍTICO

- [ ] PIX boost: `create-boost-payment` gera QR + payload + expiração 24h
- [ ] PIX plano: `create-plan-payment` idem
- [ ] Cartão boost: `create-boost-payment-card` (tokenizado, nunca armazenado)
- [ ] Cartão plano: `create-plan-payment-card` idem
- [ ] Webhook `pagarme-webhook` valida assinatura HMAC SHA-1 e rejeita inválidas
- [ ] Evento `order.paid` / `charge.paid` → credita boost / ativa assinatura
- [ ] Evento `order.payment_failed` / `charge.payment_failed` → status falho, sem crédito
- [ ] Evento `order.canceled` → tratado
- [ ] Evento `charge.refunded` → reverte estado
- [ ] Idempotência: webhook duplicado não credita duas vezes
- [ ] Status de pagamento atualiza na UI (polling/realtime) após pagar
- [ ] Preços conferem: Boosts (24h R$5, 3d R$9,90, 7d R$14,90; packs 5x) e Planos (Plus R$39,90/mo, Loja R$99,90/mo + anuais)
- [ ] Pagamento expirado (PIX 24h) trata estado corretamente

## 9. Boosts

- [ ] BoostSelectionModal mostra opções e créditos disponíveis
- [ ] Créditos por tipo (24h/3d/7d) em `user_boosts` (total/used separados)
- [ ] Aplicar boost cria `product_boosts` com `expires_at` correto
- [ ] Boost expira e produto perde destaque
- [ ] Comprar pack 5x credita corretamente na wallet

## 10. Planos / Assinaturas

- [ ] Upgrade free → plus / loja ativa via `user_subscriptions`
- [ ] `expires_at` correto para mensal vs anual
- [ ] Recursos gated por plano (ex.: cupons só plano loja)
- [ ] Downgrade/expiração de plano revoga recursos premium
- [ ] Página `/plans` reflete plano atual

## 11. Chat & Ofertas (Realtime)

- [ ] Iniciar conversa a partir de produto (cria `conversations`)
- [ ] Enviar/receber mensagens em tempo real (`postgres_changes`)
- [ ] Read receipts / `read_at` e contador de não-lidas
- [ ] Fazer oferta (OfferSheet) cria `offers`
- [ ] Contra-oferta com `parent_offer_id` encadeia corretamente (`useOffers`)
- [ ] Aceitar/recusar oferta atualiza status e UI
- [ ] OfferCard mostra estado atual da negociação
- [ ] Lista de conversas (Messages) ordena por `last_message_at`
- [ ] `useConversation` (arquivo modificado — testar regressões)

## 12. Sistema de Fila (Product Queue)

- [ ] Entrar na fila de produto reservado cria `product_queue` com posição
- [ ] Cancelar pedido promove próximo da fila via trigger automático
- [ ] Banner de comprador promovido com countdown (`get_queue_info` → `user_is_promoted`, `promotion_expires_at`)
- [ ] `minutesRemaining` / `promotionExpiresAt` em `useProductQueue` corretos
- [ ] QueueViewSheet: card de promovido + botão de promover manual
- [ ] Guard de `.in()` contra array vazio na re-fetch (commit recente — testar)
- [ ] Promoção expira e libera para próximo

## 13. Notificações (in-app + Push)

- [ ] NotificationCenter lista notificações com realtime
- [ ] Contador de não-lidas atualiza
- [ ] Marcar como lida (`read_at`)
- [ ] PushPermissionPrompt solicita permissão
- [ ] Subscrição push registra `push_subscriptions` (endpoint, p256dh, auth)
- [ ] `get-vapid-key` retorna chave pública
- [ ] `send-push-notification` entrega push (testar em device real, iOS + Android)
- [ ] Tipos de notificação: nova mensagem, oferta, venda, promoção de fila, pagamento, etc.
- [ ] Push não chega para subscrição inválida/expirada (limpeza)

## 14. Reputação & Reviews

- [ ] Deixar review pós-pedido (`/review/:orderId`) com rating + comentário
- [ ] `review_type` (comprador/vendedor) correto
- [ ] Contadores agregados em `profiles` (seller/buyer reviews count/sum) atualizam
- [ ] ReputationBadge / VerificationBadge exibem nível correto
- [ ] ReviewsList no perfil público usa `public_reviews`
- [ ] Não é possível avaliar pedido não concluído ou avaliar duas vezes

## 15. Favoritos & Seguidores

- [ ] Favoritar/desfavoritar com optimistic update (`useFavorites`)
- [ ] Par único user/product (sem duplicata)
- [ ] Página Favorites lista corretamente
- [ ] Seguir/deixar de seguir vendedor (`followers`)
- [ ] `followers_count` atualiza
- [ ] Página Following lista seguidos

## 16. Cupons (plano Loja)

- [ ] Criar cupom (percentage/fixed, `max_uses`)
- [ ] Aplicar cupom no checkout desconta corretamente
- [ ] `max_uses` esgotado bloqueia uso
- [ ] Cupom só disponível para plano loja
- [ ] Cupom de "specific" aplica só aos produtos certos

## 17. Admin & Moderação

- [ ] Dashboard `/admin`: stats corretas
- [ ] Fila de moderação aprova/rejeita produtos `pending_review`
- [ ] Gestão de usuários: suspender/reativar
- [ ] Suspensão bloqueia usuário e esconde produtos
- [ ] Gestão de assinaturas
- [ ] Logs de ação (`admin_logs`) registram cada ação com metadata
- [ ] Moderator vs admin: permissões diferenciadas
- [ ] `has_role` / RLS impede usuário comum de acessar RPCs admin

## 18. Segurança & LGPD (auditar antes do deploy)

- [ ] Nenhuma coordenada GPS exposta em views públicas/RPC/network
- [ ] CPF/CNPJ/PIX criptografados, nunca em logs
- [ ] RLS habilitado em todas as 28 tabelas e policies corretas
- [ ] Edge functions com `verify_jwt = false` validam JWT manualmente onde necessário
- [ ] Rate limiting ativo nas functions públicas (OTP, signup, reset)
- [ ] Nenhum segredo (service role key, API keys) no bundle frontend
- [ ] CORS configurado corretamente nas edge functions
- [ ] Webhook HMAC obrigatório (rejeitar sem assinatura)
- [ ] Termos e Política de Privacidade acessíveis (`/terms`, `/privacy-policy`)

## 19. PWA & Mobile

- [ ] Instalação PWA (`/install`) funciona Android + iOS
- [ ] Service worker registra e atualiza sem cache preso
- [ ] BottomNav com safe-area padding em devices com notch
- [ ] Header glass-effect + scroll-direction detection
- [ ] Pull-to-refresh
- [ ] Offline/erro de rede com fallback gracioso
- [ ] Touch targets e gestos (Framer Motion tap feedback)

## 20. UI/UX & i18n

- [ ] Todo texto em PT-BR (datas DD/MM/YYYY, moeda R$, mensagens, erros)
- [ ] Dark mode completo (ThemeProvider) sem contraste quebrado
- [ ] Tema olive/cream consistente
- [ ] Loading states / skeletons em todas as páginas
- [ ] Estados vazios com CTA
- [ ] Animações de transição de página sem jank
- [ ] Responsividade em telas pequenas e grandes

## 21. Performance & Build

- [ ] `npm run build` passa (`tsc -b && vite build`) sem erros
- [ ] `npm run lint` sem erros críticos
- [ ] React Query: `staleTime`/`gcTime` apropriados, sem refetch excessivo
- [ ] `refetchOnWindowFocus` permanece desabilitado
- [ ] Bundle size aceitável; imagens otimizadas
- [ ] Sem memory leaks em subscriptions realtime (cleanup no unmount)
- [ ] Infinite scroll não duplica/recarrega itens

## 22. Regressões dos arquivos modificados (git status atual)

- [ ] `useConversation.ts` — chat funciona sem quebra
- [ ] `Auth.tsx` / `AuthCallback.tsx` — fluxo completo de login/OAuth
- [ ] `Checkout.tsx` — fluxo de compra completo
- [ ] `complete-signup`, `verify-code`, `reset-password`, `save-user-profile` — fluxos de auth/perfil
- [ ] `pagarme-webhook` — todos os eventos de pagamento

---

### Verificações automatizáveis sugeridas

Antes do deploy, é possível rodar em paralelo com os agentes especializados:

| Verificação | Como |
|-------------|------|
| Build | `npm run build` |
| Lint | `npm run lint` |
| Auditoria LGPD/Segurança | agente `lgpd-security-auditor` |
| Queries diretas na tabela `products` | agente `product-query-guard` |
| Bump de versão | `npm run version:patch \| version:minor \| version:major` (ver `VERSIONING.md`) |
