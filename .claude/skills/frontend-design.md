---
name: frontend-design
description: Use when creating or modifying any React component, page, or UI element in the Kura project. Trigger on keywords like "page", "component", "button", "card", "layout", "style", "header", "design", "UI", "responsive", "mobile".
---

# Kura — Frontend Design System

## 1. Visão Geral

Kura é um marketplace mobile-first de roupas de segunda mão para o Brasil. Público-alvo jovem (18–35 anos). Tom visual: orgânico, acolhedor, sustentável — paleta olive/cream, tipografia sem-serif limpa, cards fotográficos com foco no produto. Toda interface é projetada para toque (44px mínimo) e funciona como PWA + App nativo (Capacitor).

---

## 2. Tokens de Design

### Cores (variáveis CSS HSL)

| Token Tailwind | CSS Var | Uso |
|---|---|---|
| `bg-background` | `--background` | Fundo de tela (cream 45 30% 97%) |
| `bg-card` | `--card` | Fundo de cards (45 25% 95%) |
| `text-foreground` | `--foreground` | Texto principal (marrom escuro) |
| `text-muted-foreground` | `--muted-foreground` | Texto secundário, labels, placeholders |
| `bg-primary` / `text-primary` | `--primary` | Verde musgo (80 60% 35%) — ações principais |
| `bg-secondary` | `--secondary` | Marrom oliva (50 40% 40%) |
| `bg-muted` | `--muted` | Fundos sutis, separadores |
| `bg-olive-warm` | `--olive-warm` | Fundo de inputs e ícones (45 25% 92%) |
| `bg-destructive` | `--destructive` | Vermelho — excluir, cancelar |
| `bg-success` | `--success` | Verde — confirmações, status ativo |
| `border-border` | `--border` | Bordas padrão (45 20% 88%) |

**Regra:** Nunca use cores hardcoded (hex/rgb). Use sempre os tokens semânticos acima.

### Sombras

| Classe | Uso |
|---|---|
| `shadow-soft` | Cards hover, elementos elevados leves |
| `shadow-card` | Padrão em `.card-premium` |
| `shadow-elevated` | Modais, sheets, elementos em primeiro plano |

### Border-Radius

| Classe Tailwind | Valor | Onde usar |
|---|---|---|
| `rounded-xl` (14px) | default | Inputs, botões, imagens internas de cards, delivery options |
| `rounded-2xl` (24px) | `.card-premium` | Cards de produto, containers de seção |
| `rounded-3xl` (28px) | Raro | Modais grandes, avatares de destaque |
| `rounded-full` | Avatares, badges circulares, ícones de nav |

### Tipografia

**Font:** `font-display` → `Helvetica Neue, Helvetica, Arial, sans-serif` (único font-family).

| Classe | Uso |
|---|---|
| `font-display text-3xl font-semibold` | Títulos de página (Home, Perfil) |
| `font-display text-2xl font-semibold` | Subtítulos de seção |
| `font-display text-xl font-semibold` | Títulos de lista (MyListings) |
| `font-display text-lg font-semibold` | Headings de card, seção de checkout |
| `text-sm font-medium` | Labels de menu, botões secundários |
| `text-sm font-semibold` | Preços, valores, dados importantes |
| `text-xs text-muted-foreground` | Contadores, metadata, timestamps |
| `text-[13px] font-semibold` | Título de produto em ProductCard |
| `text-[11px] text-muted-foreground` | Marca/tamanho em ProductCard |
| `text-[10px] font-medium` | Labels de nav, badges de status |
| `text-[10px] uppercase tracking-wider text-muted-foreground` | Section labels (CONTA, AJUDA, etc.) |

### Breakpoints (mobile-first obrigatório)

| Prefixo | Largura | Uso |
|---|---|---|
| (sem prefixo) | 0px+ | Mobile — layout base |
| `sm:` | 640px+ | Raramente usado |
| `md:` | 768px+ | Tablet |
| `lg:` | 1024px+ | Desktop — grid 2 colunas, sidebar |
| `xl:` | 1280px+ | Desktop largo |

---

## 3. Classes Utilitárias Globais (src/index.css)

| Classe | O que faz | Quando usar |
|---|---|---|
| `.card-premium` | `rounded-2xl bg-card border border-border/50` + shadow-card + hover:shadow-elevated | Todo container de seção ou agrupamento de conteúdo |
| `.card-elevated` | `rounded-2xl bg-card` + shadow-elevated | Modais, cards de destaque |
| `.glass-effect` | `backdrop-blur-xl bg-background/80` | Headers sticky, bottom bars fixed |
| `.btn-primary` | `bg-primary text-primary-foreground rounded-xl px-6 py-3 font-medium` + tap feedback | Botão de ação principal |
| `.input-premium` | `bg-olive-warm border-0 rounded-xl px-4 py-3` + focus:ring-primary/30 | Todos os inputs de formulário |
| `.badge-status` | `inline-flex items-center px-3 py-1 rounded-full text-xs font-medium` | Badges de status (ativo, vendido, etc.) |
| `.nav-item` | `flex flex-col items-center gap-1 text-muted-foreground` + `.active:text-primary` | Itens do BottomNav |
| `.product-image` | `aspect-[3/4] object-cover rounded-xl` | Imagens de produto em listagem |
| `.tap-feedback` | active:scale(0.97) transition | Qualquer elemento interativo sem feedback nativo |
| `.gradient-primary` | Verde → accent linear-gradient 135deg | Banners, headers de destaque |

---

## 4. Componentes shadcn Disponíveis (src/components/ui/)

52 componentes instalados. Os mais usados:

| Componente | Quando usar | Quando NÃO usar |
|---|---|---|
| `Button` | Ações padrão com variants: default, outline, ghost, destructive | Ação principal de CTA (use `.btn-primary`) |
| `Sheet` | Bottom sheets, drawers de filtro | Modais centralizados (use Dialog) |
| `Dialog` | Confirmações, modais centralizados | Conteúdo longo em mobile (use Sheet) |
| `Skeleton` | Loading states de qualquer conteúdo | Indicador de progresso (use Progress) |
| `Badge` | Labels de status inline | Badges de navegação (use badge-status) |
| `Avatar` | Fotos de perfil | Ícones genéricos (use Lucide) |
| `Separator` | Divisores visuais entre seções | Espaçamento (use margin/padding) |
| `Tabs` | Navegação entre views na mesma página | Navegação principal (use BottomNav) |
| `Select` | Dropdowns de formulário | Filtros rápidos (use Sheet + botões) |
| `Switch` | Toggles booleanos | Multi-select (use Checkbox) |

---

## 5. Padrões de Layout

### Estrutura de Página Padrão

```tsx
// Toda página usa AppLayout
<AppLayout>
  {/* Header sticky (se não usa o global) */}
  <header className="sticky top-0 z-40 glass-effect border-b border-border/30">
    <div className="flex items-center gap-3 px-4 py-3">
      {/* conteúdo */}
    </div>
  </header>

  {/* Conteúdo principal */}
  <motion.div
    initial="hidden" animate="visible" variants={staggerContainer}
    className="px-4 py-4 space-y-6"
  >
    {/* seções */}
  </motion.div>
</AppLayout>
```

### Grid de Produtos

```tsx
// Catálogo — 2 colunas mobile, 3 tablet, 4 desktop
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
  {products.map(p => <ProductCard key={p.id} product={p} />)}
</div>
```

### Espaçamento de Containers

| Situação | Classe |
|---|---|
| Padding horizontal de página | `px-4` |
| Padding vertical de página | `py-4` (listagem) ou `py-6` (detail/formulário) |
| Espaço entre seções | `space-y-6` |
| Espaço interno de card | `p-4` ou `p-5` (profile cards) |
| Espaço entre itens de lista | `space-y-3` |
| Safe area bottom (fixed bars) | `pb-safe` ou `pb-4 mb-[env(safe-area-inset-bottom)]` |

---

## 6. Padrão Definitivo dos Componentes Recorrentes

### Card de Produto (ProductCard)

```tsx
<div className="card-premium overflow-hidden">
  {/* Imagem */}
  <div className="relative aspect-square overflow-hidden">
    <img className="w-full h-full object-cover" />
    {/* Badges: top-2 left-2, top-2 right-2, bottom-2 left-2 */}
    <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded-md" />
  </div>
  {/* Info */}
  <div className="p-2 space-y-1">
    <p className="text-[13px] font-semibold line-clamp-1">{title}</p>
    <p className="text-[11px] text-muted-foreground">{brand} · {size}</p>
    <p className="text-sm font-semibold text-primary">{price}</p>
  </div>
</div>
```

### Botões — Três Tamanhos Padrão

```tsx
// Grande — CTAs principais (checkout, confirmar compra)
<button className="btn-primary w-full h-14 text-base">Confirmar</button>

// Médio — Ações de formulário, cards
<button className="btn-primary h-12 px-6">Salvar</button>

// Padrão — Ações secundárias
<Button variant="outline" className="h-10 rounded-xl">Cancelar</Button>
```

**Nunca misture `btn-primary` com h-11 — use h-12 ou h-14.**

### Input com Label e Erro

```tsx
<div className="space-y-2">
  <Label className="text-sm font-medium">{label}</Label>
  <input className="input-premium w-full" placeholder={placeholder} />
  {error && <p className="text-xs text-destructive">{error}</p>}
</div>
```

### Loading State (Skeleton)

```tsx
// Card de produto
<div className="card-premium overflow-hidden">
  <Skeleton className="aspect-square rounded-none" />
  <div className="p-2 space-y-1.5">
    <Skeleton className="h-4 w-3/4 rounded-lg" />
    <Skeleton className="h-3 w-1/2 rounded-lg" />
  </div>
</div>

// Lista de itens
<Skeleton className="h-24 w-full rounded-2xl" />
```

### Empty State

```tsx
// Padrão completo (MyListings, Favorites, etc.)
<div className="card-premium p-8 text-center space-y-3">
  <Icon className="w-12 h-12 text-muted-foreground/40 mx-auto" />
  <div>
    <p className="font-medium text-foreground">Nenhum item ainda</p>
    <p className="text-sm text-muted-foreground mt-1">{description}</p>
  </div>
  {action && <Button className="mt-2">{action}</Button>}
</div>

// Mínimo (inline em listagem)
<p className="text-center text-muted-foreground py-8">{message}</p>
```

### Estado de Erro

```tsx
<div className="card-premium p-6 text-center space-y-3">
  <AlertCircle className="w-10 h-10 text-destructive/60 mx-auto" />
  <p className="text-sm text-muted-foreground">{errorMessage}</p>
  <Button variant="outline" onClick={retry} className="rounded-xl h-10">
    Tentar novamente
  </Button>
</div>
```

### Section Label (CONTA, AJUDA, etc.)

```tsx
<h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-3">
  NOME DA SEÇÃO
</h2>
```

### Menu Row (Settings, Profile)

```tsx
<Link to={href} className="flex items-center gap-4 p-4 hover:bg-olive-warm/50 transition-colors">
  <div className="w-10 h-10 rounded-xl bg-olive-warm flex items-center justify-center">
    <Icon className="w-5 h-5 text-primary" />
  </div>
  <div className="flex-1 min-w-0">
    <p className="font-medium text-foreground">{label}</p>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
  <ChevronRight className="w-5 h-5 text-muted-foreground" />
</Link>
```

---

## 7. Regras Obrigatórias

1. **Mobile-first sempre** — escreva classes base para 375px, adicione prefixos `md:` / `lg:` para telas maiores
2. **Tokens semânticos** — nunca `text-[#5a7a32]`, use `text-primary`
3. **Alt em toda imagem** — `<img alt="descrição" />` sem exceção
4. **aria-label em ícones interativos** — `<button aria-label="Fechar">` quando não há texto visível
5. **Lazy loading em imagens** — `loading="lazy"` em todas exceto LCP (acima da dobra)
6. **Nunca criar novo card pattern** — use `.card-premium` ou `.card-elevated`
7. **Nunca hardcode cores** — sem `#hex`, `rgb()`, `hsl()` literals em className
8. **Animações via Framer Motion** — não usar `transition-all` para animações complexas; use `motion.div` com variants de `src/lib/animations.ts`
9. **Proibido** adicionar bibliotecas de UI além de shadcn/ui + Radix. Para ícones: apenas Lucide React
10. **Altura mínima de touch targets**: 44px (use `h-11` como mínimo em elementos clicáveis)

---

## 8. Anti-Padrões — O Que Evitar

| Anti-padrão | Correção |
|---|---|
| `<div className="rounded-2xl bg-card border shadow">` | Use `.card-premium` |
| `className="rounded-xl"` dentro de `.card-premium` | `card-premium` já tem `rounded-2xl`; não sobrescreva com `rounded-xl` |
| `<button className="btn-primary h-11">` | Use `h-12` (médio) ou `h-14` (grande) |
| Empty state com só `<p>Nenhum item</p>` | Use o padrão `.card-premium p-8` com ícone |
| `<Skeleton className="h-24 w-full">` sem rounded | Adicione `rounded-2xl` |
| `style={{ color: '#5a7a32' }}` | `className="text-primary"` |
| Imagens sem dimensão definida causando layout shift | Sempre defina `aspect-ratio` ou `width/height` no container |
| `<div className="flex flex-col gap-4 p-4">` para seção de página | Use `<motion.div className="px-4 py-4 space-y-6">` |
| Criar spinner com CSS puro | Use `<Loader2 className="w-6 h-6 animate-spin text-primary" />` |
| `transition-all duration-300` em hover de card | `.card-premium` já tem transição de sombra; não adicione `transition-all` |

---

## 9. Como Usar Esta Skill

**Leia este arquivo completo antes de qualquer tarefa de frontend.**

- Ao criar um novo componente: verifique seção 5 (padrão de layout) e seção 6 (componentes recorrentes)
- Ao aplicar estilos: use exclusivamente os tokens da seção 2 e classes da seção 3
- Em caso de dúvida entre dois estilos: escolha o mais simples e consistente com o código existente
- Ao encontrar uma inconsistência não listada aqui: corrija-a usando o padrão desta skill e documente

**Inconsistências conhecidas ainda não corrigidas:**
- `py-4` vs `py-6` em containers de página — padrão a adotar: `py-4` listagem, `py-6` formulários/detail
- Spinner sizes: use `w-6 h-6` para inline, `w-8 h-8` para tela cheia
- SellerCard usa `border border-border` direto em vez de `.card-premium` — pode ser migrado
