# Configuracao Sign in with Apple no Supabase

## No Apple Developer Portal

1. Acesse [Apple Developer](https://developer.apple.com/account) e faca login com sua conta de desenvolvedor.
2. Va em **Certificates, Identifiers & Profiles**.
3. Em **Identifiers**, crie um novo **App ID**:
   - Platform: iOS
   - Bundle ID: `com.kuralab.app` (ou o bundle ID do seu app)
   - Marque a capability **Sign in with Apple**
4. Crie um **Services ID** (usado para web/OAuth):
   - Identifier: `com.kuralab.web` (identificador unico)
   - Marque **Sign in with Apple** e clique em **Configure**
   - Primary App ID: selecione o App ID criado no passo 3
   - Domains: `kuralab.com.br`
   - Return URLs: `https://<SEU_PROJECT_REF>.supabase.co/auth/v1/callback`
     (substitua `<SEU_PROJECT_REF>` pelo ID do seu projeto Supabase)
5. Crie uma **Key** (chave privada):
   - Va em **Keys** e clique em **+**
   - Nome: `Kura Sign in with Apple`
   - Marque **Sign in with Apple** e associe ao App ID criado
   - Faca download do arquivo `.p8` (voce so pode baixa-lo uma vez)
   - Anote o **Key ID** exibido

## No Supabase Dashboard

- URL: **Authentication** > **Providers** > **Apple**
- Ative o provider Apple
- Preencha os campos:

| Campo | Valor |
|-------|-------|
| **Client ID (Services ID)** | `com.kuralab.web` (o Services ID criado no passo 4) |
| **Secret Key** | Cole o conteudo completo do arquivo `.p8` baixado |
| **Key ID** | O Key ID anotado no passo 5 do Apple Developer Portal |
| **Team ID** | Seu Apple Team ID (visivel no canto superior direito do Developer Portal) |

- **Redirect URL** a configurar no Apple Developer Portal (Return URL do Services ID):
  ```
  https://<SEU_PROJECT_REF>.supabase.co/auth/v1/callback
  ```
  Esse valor aparece no Supabase Dashboard ao configurar o provider Apple.

## Configuracao nativa iOS (Capacitor/Xcode)

Para que o Sign in with Apple funcione no app nativo:

1. No Xcode, va em **Signing & Capabilities** do target principal
2. Clique em **+ Capability** e adicione **Sign in with Apple**
3. Certifique-se de que o entitlement `com.apple.developer.applesignin` esta presente no arquivo `App.entitlements`

## Variaveis de ambiente necessarias

Nao ha variaveis de ambiente adicionais no frontend. A configuracao e feita inteiramente no:
- **Apple Developer Portal** (Services ID, Key)
- **Supabase Dashboard** (Provider Apple com Client ID, Secret Key, Key ID, Team ID)

O frontend usa `supabase.auth.signInWithOAuth({ provider: 'apple' })` que redireciona automaticamente para o fluxo OAuth configurado no Supabase.

## Testando localmente

1. O Sign in with Apple requer HTTPS em producao, mas funciona via redirect em `localhost` para desenvolvimento
2. Adicione `http://localhost:8080/auth/callback` e `http://localhost:5173/auth/callback` como Return URLs adicionais no Services ID durante desenvolvimento (Apple permite multiplas URLs)
3. Atencao: Apple so envia o nome do usuario na **primeira** autorizacao. Se precisar testar novamente, revogue o acesso em [appleid.apple.com](https://appleid.apple.com) > Seguranca > Apps que usam o Apple ID
