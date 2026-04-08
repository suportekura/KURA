# Checklist: Publicação Kura na App Store (Mac)

## Pré-requisitos
- [ ] macOS com Xcode instalado (versão mínima: 15.0)
- [ ] Apple Developer Account ativa (conta: [preencher])
- [ ] Node.js 20+ instalado
- [ ] Projeto clonado e `npm install` executado

## 1. Configurar iOS no Capacitor
- [ ] `npm run build`
- [ ] `npx cap add ios`
- [ ] `npx cap sync`

## 2. Copiar configurações do ios-config/
- [ ] Copiar `ios-config/Info.plist.template` → `ios/App/App/Info.plist` (substituir permissões)
- [ ] Copiar `ios-config/App.entitlements.template` → `ios/App/App/App.entitlements`

## 3. Configurar no Xcode
- [ ] Abrir `ios/App/App.xcworkspace` no Xcode
- [ ] Bundle Identifier: `com.kuralab.app`
- [ ] Display Name: `Kura`
- [ ] Version: `1.0.0` | Build: `1`
- [ ] Deployment Target: iOS 16.0 (mínimo recomendado)
- [ ] Selecionar Apple Developer Team em Signing & Capabilities
- [ ] Habilitar capability: **Sign in with Apple**
- [ ] Habilitar capability: **Push Notifications**
- [ ] Habilitar capability: **Associated Domains** → `applinks:kuralab.com.br`

## 4. Configurar Sign in with Apple (Apple Developer Portal)
- [ ] Acessar developer.apple.com → Certificates, IDs & Profiles
- [ ] Criar/verificar App ID `com.kuralab.app` com capability "Sign in with Apple" ativa
- [ ] Criar Service ID para web flow se necessário
- [ ] Configurar redirect URL no Apple: `https://[SEU-SUPABASE-PROJECT].supabase.co/auth/v1/callback`
- [ ] Consultar `APPLE_SUPABASE_CONFIG.md` para configuração no Supabase Dashboard

## 5. Testar no simulador
- [ ] Selecionar iPhone 15 Pro no simulador
- [ ] Product → Run (⌘R)
- [ ] Testar fluxo completo de login (Email + Google + Apple)
- [ ] Testar upload de foto de produto
- [ ] Testar notificações push
- [ ] Testar permissão de localização
- [ ] Selecionar iPhone SE (3rd gen) e repetir testes principais

## 6. Build de produção
- [ ] Selecionar "Any iOS Device (arm64)" como destino
- [ ] Product → Archive
- [ ] Aguardar archive completar (pode demorar 5-10 minutos)

## 7. Submeter para App Store Connect
- [ ] No Xcode Organizer: Distribute App → App Store Connect
- [ ] Validate App (sem erros antes de subir)
- [ ] Upload to App Store Connect

## 8. App Store Connect
- [ ] Criar novo app em appstoreconnect.apple.com
- [ ] Preencher metadados PT-BR: nome, subtítulo, descrição, palavras-chave
- [ ] Upload screenshots obrigatórios:
  - [ ] iPhone 6.7" (iPhone 15 Pro Max) — mínimo 3 telas
  - [ ] iPhone 6.5" (iPhone 14 Plus) — mínimo 3 telas  
  - [ ] iPhone 5.5" (iPhone 8 Plus) — mínimo 3 telas
- [ ] URL da Política de Privacidade: `https://kuralab.com.br/privacy-policy`
- [ ] Preencher Apple Privacy Nutrition Label (data collected, linked to user, etc.)
- [ ] Configurar classificação etária (17+ por marketplace com transações)
- [ ] Submeter para review

## 9. Pós-aprovação
- [ ] Configurar App Store Optimization (ASO) — keywords, screenshots
- [ ] Habilitar TestFlight para beta testers antes do lançamento público
- [ ] Configurar phased release (opcional — 7 dias de rollout gradual)
