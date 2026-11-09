# ACHADOS — Backend OAuth Mercado Livre (Cloudflare Workers)

Este backend é **uma implementação inicial**, não uma integração ativada. A página estática no GitHub Pages não guarda segredos. A conta do Mercado Livre continua desconectada até que o próprio titular conclua a autorização.

## Recursos

- Fluxo OAuth Authorization Code + PKCE (S256) com `state` aleatório e uso único (10 minutos).
- Callback seguro e fixo, compatível com o cadastro da aplicação Mercado Livre.
- Troca de código por token no Worker, nunca no navegador.
- Access/refresh tokens criptografados em AES-GCM (chave de 256 bits), guardados no banco Cloudflare D1.
- Renovação de tokens sob demanda, armazenando o novo refresh token.
- Endpoints administrativos: status, iniciar conexão, consultar `/users/me`, desvincular.
- Restrições de CORS e autenticação por chave administrativa forte.
- **Não consulta o Hub de Afiliados nem sincroniza produtos automaticamente**.

## Antes de cadastrar a URL de redirect

1. Crie uma conta em https://dash.cloudflare.com/ caso ainda não tenha. É possível iniciar pelo plano gratuito, sujeito às cotas.
2. No computador com Node.js, clone o projeto ACHADOS do GitHub e abra o terminal na pasta `worker`.
3. Execute `npm install` e `npx wrangler login`.
4. Execute `npx wrangler d1 create achados-oauth`. Copie apenas o `database_id` retornado para `worker/wrangler.toml` (não é segredo).
5. Execute `npx wrangler d1 migrations apply achados-oauth --remote`.
6. Altere `PUBLIC_BASE_URL` para o endereço HTTPS real que o Worker terá, por exemplo `https://achados-meli-oauth.SEUSUBDOMINIO.workers.dev`. Ele precisa coincidir com o endereço publicado; não use o endereço de exemplo literalmente. Configure o subdomínio workers.dev na Cloudflare se necessário.
7. Execute `npx wrangler deploy`. Depois confira o endereço retornado. Se for diferente de `PUBLIC_BASE_URL`, corrija o arquivo e repita o deploy.
8. Agora você pode informar no cadastro do Mercado Livre a **URL de redirect exata**:
   `https://achados-meli-oauth.SEUSUBDOMINIO.workers.dev/oauth/callback`
   **Não use GitHub Pages como callback OAuth.**

## Depois que o Mercado Livre criar sua aplicação

Configure os quatro segredos pelo terminal dentro da pasta `worker`:

```bash
npx wrangler secret put MELI_APP_ID
npx wrangler secret put MELI_CLIENT_SECRET
npx wrangler secret put OWNER_KEY
npx wrangler secret put TOKEN_ENCRYPTION_KEY
```

- `MELI_APP_ID`: ID informado na aplicação Mercado Livre.
- `MELI_CLIENT_SECRET`: segredo privado; **não envie a ninguém nem coloque no GitHub**.
- `OWNER_KEY`: crie uma chave administrativa aleatória de pelo menos 32 caracteres, exclusiva para administrar o ACHADOS. Ela não é a senha da conta Mercado Livre.
- `TOKEN_ENCRYPTION_KEY`: Base64 de **32 bytes criptograficamente aleatórios**. Gere localmente, por exemplo usando Node.js: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Nunca registre o valor no repositório, chats ou prints.

Depois, repita `npx wrangler deploy` para garantir que a configuração esteja ativa.

## Conectar sua conta

1. No ACHADOS, abra a nova aba **Mercado Livre**.
2. Informe a URL pública do Worker, sem caminho final, e a `OWNER_KEY` (não é a senha do Mercado Livre).
3. Clique em **Verificar conexão**; depois em **Conectar Mercado Livre**.
4. Autorize na página oficial do Mercado Livre. O callback redirecionará à página inicial do ACHADOS.
5. Na aba Mercado Livre, informe a chave administrativa novamente (não é persistida) e clique **Verificar conexão** / **Verificar minha conta**.

O login real depende do Client ID, Client Secret, URL de redirect e permissões corretas no Mercado Livre. **Não habilite escopos desnecessários.** A conta deve ser do titular autorizado.

## Endpoints

- `GET /`: resposta de saúde pública sem credenciais.
- `GET /api/status`: requer cabeçalho `x-owner-key`; informa status e ID da conta.
- `POST /api/connect/start`: requer chave; cria estado e retorna URL de autorização.
- `GET /oauth/callback`: recebe code + state do Mercado Livre (exclusivo para OAuth).
- `GET /api/me`: requer chave; renova o token se necessário e chama a API oficial `/users/me`.
- `POST /api/disconnect`: requer chave; apaga a conexão armazenada.

## Notas de segurança e limites

- Configure `FRONTEND_ORIGIN = "https://andreischlittler1818-ai.github.io"`, sem barra final, para limitar os acessos a partir da interface.
- A autenticação com `OWNER_KEY` é adequada apenas a uma instalação pessoal inicial. Antes de dar acesso a outras pessoas, implementar autenticação por usuário, proteção contra tentativas abusivas e controles de acesso completos.
- O acesso à URL do Worker não autoriza publicações em redes sociais. Não fornecemos acesso ao catálogo específico do Hub de Afiliados sem uma API oficial documentada.
- A chave de criptografia deve permanecer estável. Se perdê-la, o token guardado não poderá ser recuperado.
- Durante o cadastro do app Mercado Livre, habilite Authorization Code, PKCE e Refresh Token conforme suportado pelo formulário; escolha Mercado Livre como unidade de negócio e acesso mínimo de leitura.
- O banco D1 e o Worker possuem cotas no plano gratuito, que podem mudar. Consulte preços oficiais antes de aumentar o uso.

Referências:
- https://developers.mercadolivre.com.br/pt_br/mensagens-post-venda/autenticacao-e-autorizacao
- https://developers.cloudflare.com/workers/get-started/guide/
- https://developers.cloudflare.com/d1/
