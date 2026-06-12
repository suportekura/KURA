# Kura — Inventário de Identidade de Marca

> Extraído do código-fonte para servir de base a um brand book.
> Fonte: `tailwind.config.ts`, `src/index.css`, `index.html`, `vite.config.ts` (manifest PWA),
> `package.json`, assets em `src/assets/` e `public/`, componentes `ui/` e copies de telas.
> **Nada foi inventado — apenas extraído do que existe no repositório.**

---

## 1. Identidade do Produto

| Campo | Valor |
|-------|-------|
| **Nome** | Kura |
| **Descrição** | Marketplace de brechó online (moda circular): pessoas físicas (PF), brechós e vendedores independentes compram e vendem roupas usadas perto de si, com filtro por distância, chat com ofertas, PIX/cartão, assinaturas de vendedor e impulsionamento de anúncios. |
| **Tagline** | "Descubra peças únicas perto de você!" (manifest PWA) |
| **URL** | https://kuralab.com.br |
| **Stack** | React 18 · TypeScript 5.8 · Vite + SWC · Tailwind 3.4 · shadcn/ui (Radix) · React Query v5 · React Hook Form + Zod · Framer Motion · Supabase · Capacitor (iOS) · vite-plugin-pwa · Pagar.me · Vercel |

---

## 2. Público-alvo

- **Segmento:** Marketplace C2C/B2C (peer-to-peer) de moda de segunda mão — brechó online brasileiro.
- **Perfil de usuário:** Vendedores Pessoa Física (indivíduos), brechós e Pessoa Jurídica ("Loja Oficial"), e compradores de moda circular no Brasil. Cadastro segmentado em **PF** e **PJ**.
- **Contexto de uso:** Mobile-first (PWA + app Capacitor iOS), baseado em geolocalização ("perto de você") com filtro por distância, preço e condição. UI 100% em **PT-BR** e moeda **BRL**.

---

## 3. Paleta de Cores

Tokens em **HSL** via CSS variables (`src/index.css`), expostos no Tailwind como `hsl(var(--token))`.

### Light mode — "Pastel Natural Premium"

| Variável | Valor | Papel | Uso |
|----------|-------|-------|-----|
| `--primary` / `theme_color` | `hsl(96 20% 29%)` ≈ `#47593B` (token) · `#5a7a32` (PWA/logo) | primary | Verde musgo da marca — botões, nav ativa, foco, links, header |
| `--background` | `hsl(45 30% 97%)` ≈ `#FAF8F2` · `#f7f5f0` (PWA) | background | Fundo creme |
| `--foreground` | `hsl(40 15% 20%)` ≈ `#3A352C` | text | Texto principal (marrom morno) |
| `--secondary` | `hsl(50 40% 40%)` ≈ `#8F7B33` | secondary | Marrom oliva pastel — botões secundários |
| `--muted` | `hsl(60 25% 50%)` ≈ `#9F9F60` | muted | Textos/elementos atenuados |
| `--accent` | `hsl(60 30% 55%)` ≈ `#ACAC63` | accent | Amarelo esverdeado — hover ghost/outline |
| `--card` | `hsl(45 25% 95%)` ≈ `#F4F1E9` | surface | Fundo de cards |
| `--destructive` | `hsl(0 60% 50%)` ≈ `#CC3333` | error | Ações destrutivas, erros |
| `--success` | `hsl(100 26% 34%)` ≈ `#44703E` | success | Confirmações |
| `--border` | `hsl(45 20% 88%)` ≈ `#E6E0D4` | border | Bordas, scrollbar |
| `--input` | `hsl(45 20% 90%)` ≈ `#EAE5DA` | input | Campos de formulário |
| `--ring` | `hsl(96 20% 29%)` | focus-ring | Anel de foco |
| `--olive-warm` | `hsl(45 25% 92%)` ≈ `#F0EBE0` | custom-surface | Inputs premium, gradiente |
| `--olive-muted` | `hsl(50 20% 85%)` ≈ `#E0DAC9` | custom-surface | Superfícies oliva suaves |

### Dark mode — "Luxury Premium"

| Variável | Valor | Uso |
|----------|-------|-----|
| `--primary` | `hsl(98 17% 28%)` | Verde musgo deep (igual à caixa da logo) |
| `--background` | `hsl(80 20% 10%)` ≈ `#1C1F16` | Fundo verde-musgo quase preto |

### Cores de selo (fora da paleta olive)

| Selo | Cor aprox. | Uso |
|------|-----------|-----|
| Vendedor Verificado | `#3399FF` (azul) | `badge-verified.png` |
| Loja Oficial | `#D4AF2A` (dourado/mostarda) | `badge-store.png` |

---

## 4. Tipografia

- **Fonte da UI:** `'Helvetica Neue', Helvetica, Arial, sans-serif` — **font stack do sistema**, NÃO carregada de Google Fonts/CDN. Definida como `font-display` **e** `font-body` no Tailwind e em `body`/`headings`.
- **Fonte do logotipo:** uma **serifa (slab/serif)** — existe apenas rasterizada/vetorizada nos arquivos de logo, **não disponível na UI**.
- **Pesos usados:** 400 (normal), 500 (medium — headings), 600 (semibold — títulos de card).

| Nível | Tamanho | Peso | Line-height |
|-------|---------|------|-------------|
| h1 | (utilitário no uso, sem token global) | 500 `font-medium` | `tracking-tight` |
| h2 | (utilitário no uso) | 500 `font-medium` | `tracking-tight` |
| h3 (CardTitle) | 1.5rem / 24px (`text-2xl`) | 600 `font-semibold` | `leading-none` / `tracking-tight` |
| body | 1rem / 16px (`antialiased`) | 400 | normal |
| caption (`text-sm`) | 0.875rem / 14px | 400–500 | normal |

---

## 5. Logotipo & Ícones

**Arquivos** (`src/assets/`):
- `kura-logo-main.png` — monograma **K** creme em caixa quadrada verde-oliva arredondada, com broto/folha sobre o K.
- `kura-icon.png` — versão ícone do K em caixa olive.
- `kura-wordmark-flat.png` — wordmark **KURA** serifado, creme com sombra oliva + folha.
- `kura-logo.png` — wordmark **Kura** serif itálico creme.
- `kura-logo-auth.png` — logo da tela de login.
- `kura-k.svg` / `kura-k-dark.svg` / `kura-k-light.svg` — monograma **K** vetorial (variantes claro/escuro).
- `leaf-icon.png` — folha/broto isolado (símbolo de sustentabilidade).

**Ícones de sistema:** `public/favicon.ico`, `favicon.png` (64×64), `pwa-192x192.png`, `pwa-512x512.png` (incl. maskable), `apple-touch-icon.png` + `apple-icons/*.png` (60/76/120/152/167/180).

**Variações:** K em caixa olive (app icon) · wordmark KURA serif · wordmark Kura serif itálico · K isolado SVG dark/light · folha isolada · selos verificado/loja.

**Biblioteca de ícones:** **Lucide React** (`lucide-react ^0.462.0`).

---

## 6. Componentes Visuais Recorrentes

- **Border-radius:** base `--radius: 1rem` (16px). Escala: `sm≈12` · `md≈14` · `lg=16` · `xl=20` · `2xl=24` · `3xl=28`px. Botões/inputs shadcn = `rounded-md` (~14px); variantes "premium" = `rounded-xl/2xl` (20–24px); badges/avatares = `rounded-full`.
- **Sombras:**
  - `--shadow-soft: 0 2px 20px -4px hsl(40 15% 20% / 0.08)`
  - `--shadow-card: 0 4px 24px -8px hsl(40 15% 20% / 0.1)`
  - `--shadow-elevated: 0 8px 40px -12px hsl(40 15% 20% / 0.15)`
  - (dark) equivalentes com `hsl(0 0% 0%)` e opacidade 0.3–0.5.
- **Espaçamento:** escala default do Tailwind. `container` centralizado, padding `1rem`, `2xl=1400px`. Padding de card recorrente `p-6`. Sem escala custom.
- **Botões:** variantes `default` · `destructive` · `outline` · `secondary` · `ghost` · `link` + classe custom `.btn-primary` (hover `scale(1.02)`, active `scale(0.97)`, glow olive). Tamanhos `sm h-9` · `default h-10` · `lg h-11` · `icon h-10 w-10`.
- **Cards:** `rounded-lg`, border, `bg-card`, `shadow-sm` (shadcn) — variante `.card-premium`: `rounded-2xl`, `border/50`, `shadow-card → shadow-elevated` no hover.
- **Inputs:** `h-10`, `rounded-md`, `border-input`, foco `ring-2 ring-ring` — variante `.input-premium`: `bg-olive-warm`, sem borda, `rounded-xl`, foco `ring-2 ring-primary/30`.
- **Microinterações:** `tap-feedback` (`scale 0.97`), `heart-pulse`, `fade-up`, `scale-in`, `slide-up`, `glass-effect` (backdrop-blur).

---

## 7. Tom & Voz

- **Estilo:** PT-BR informal, amigável e **direto**, vocabulário simples e orientado à ação. Comentários internos de design usam "Pastel Natural Premium" e "Luxury Premium".
- **Usa emoji:** **Sim** — concentrados em mensagens de sucesso/notificação (🎉 cadastro/pedido, 🚀 impulsionamento, 📦 entrega), nunca em labels estruturais.
- **Exemplos de copy:**
  - "Compre e venda peças únicas perto de você"
  - "Descubra peças únicas perto de você!"
  - "Encontre peças únicas, venda roupas que não usa mais e participe da moda circular."
  - "A Kura conecta pessoas, brechós e vendedores independentes em um marketplace de moda circular."
  - "Informe seus dados para começar" · "Complete seu cadastro para continuar"
  - "Cadastro concluído! 🎉" · "Produto impulsionado! 🚀" · "📦 Pedido entregue"
  - "Nenhum produto encontrado / Tente outros filtros ou categorias"
  - "Loja Oficial" · "Vendedor Verificado"

---

## 8. Posicionamento & Valores (inferido)

- **Adjetivos visuais:** natural · orgânico · terroso/earthy · sustentável · premium/aconchegante · pastel e suave · minimalista · mobile-first · acolhedor.
- **Diferencial:** Moda circular com **proximidade geográfica** — comprar/vender roupas de segunda mão "perto de você" (cálculo de distância), conectando pessoas, brechós e vendedores independentes. Paleta verde-oliva + creme + folha reforça a sustentabilidade.
- **Valores/missão:** sem doc formal no código, mas a comunicação evidencia **sustentabilidade / moda circular**, reaproveitamento ("venda roupas que não usa mais"), comunidade local e conexão entre pessoas. Símbolo folha/broto + paleta olive são os portadores visuais desse valor.

---

## Observações (achados fora do schema)

- **Inconsistência tipográfica logo × UI:** o logotipo é serifado (slab/serif), mas a UI usa Helvetica Neue (sans-serif do sistema). Não há fonte serifada disponível para textos editoriais — a serifa do logo só existe dentro dos assets.
- **Sem webfonts:** nenhuma fonte é carregada (sem Google Fonts, sem `@font-face`, sem preload). A marca não tem fonte proprietária controlada no produto.
- **Dois "verdes primários" divergentes:** `theme-color`/PWA = `#5a7a32` (vivo, igual à logo) vs token `--primary` = `hsl(96 20% 29%)` ≈ `#47593B` (mais escuro). A cor da logo e a dos botões **não são idênticas** — unificar no brand book.
- **Comentários de design reveladores:** `index.css` rotula light como "Pastel Natural Premium" e dark como "Luxury Premium" — vocabulário de posicionamento útil.
- **Sem `README.md` de projeto** nem doc de missão/valores; identidade verbal inferida de meta tags, manifest PWA e copies.
- **Selos com cores fora da paleta:** azul (Vendedor Verificado) e dourado (Loja Oficial) — cores de status/confiança que merecem entrada própria no design system.
- **Tokens custom pouco explorados:** `--olive-warm`, `--olive-muted`, `.gradient-primary`, `.gradient-surface`, `.glass-effect` existem mas têm uso pontual.
- **Radius alto + microinterações de scale** definem personalidade suave, tátil e mobile-nativa, coerente com "natural/premium".
- **Base de design tokens madura:** HSL via CSS vars, dark mode completo, escala de radius e 3 níveis de sombra.
