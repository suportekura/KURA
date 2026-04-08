# Versionamento do Kura

A versão do app vive em `package.json` e é exposta no build via `__APP_VERSION__`
(definida em `vite.config.ts`). É exibida para o usuário em **Configurações → rodapé**.

## Regras de bump

| Tipo de mudança | Comando | Exemplo |
|----------------|---------|---------|
| Bug fix, ajuste visual, copy, dep update | `npm run version:patch` | 1.0.0 → 1.0.1 |
| Nova feature, nova página, nova integração | `npm run version:minor` | 1.0.1 → 1.1.0 |
| Quebra de compatibilidade, redesign completo, migração de stack | `npm run version:major` | 1.1.0 → 2.0.0 |

## Quando bumpar

**Sempre que for fazer merge para `main`**, determine o tipo de mudança e execute
o comando correspondente antes de commitar. O bump deve ser o último commit do PR/branch.

## Fluxo obrigatório antes de mergear para main

```bash
# 1. Decidir o tipo (patch / minor / major)
npm run version:patch   # ou version:minor / version:major

# 2. O comando atualiza package.json automaticamente (sem criar tag git)
# 3. Adicionar package.json ao commit
git add package.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"

# 4. Mergear para main normalmente
```

## Exemplos de classificação

**patch** — `npm run version:patch`
- Corrigir bug no checkout
- Atualizar dependência vulnerável
- Ajustar texto de erro
- Fix de CSS/layout

**minor** — `npm run version:minor`
- Adicionar Sign in with Apple
- Nova página (ex: `/boosts`)
- Nova Edge Function
- Integrar novo provider de pagamento

**major** — `npm run version:major`
- Migrar de PWA para Capacitor (app nativo)
- Redesign completo do app
- Trocar banco de dados ou auth provider
- Mudança de domínio principal
