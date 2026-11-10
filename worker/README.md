# ACHADOS — Backend OAuth Mercado Livre (Cloudflare Workers)

Este backend é **uma implementação inicial**, não uma integração ativada. A página estática no GitHub Pages não guarda segredos. A conta do Mercado Livre continua desconectada até que o próprio titular conclua a autorização.

## Instalação existente via painel (ACHADOS)

A conta já possui o Worker `achados-meli-oauth` e o banco D1 `achados-oauth`, com binding `DB` configurado pelo painel. O `wrangler.toml` foi atualizado com o ID de banco e URL pública reais. **Não crie outro banco nem reaplique as tabelas já criadas manualmente.**

Em **Workers & Pages → achados-meli-oauth → Settings → Builds**, o repositório é `andreischlittler1818-ai/ACHADOS`, branch `main`, diretório raiz `/`, build command `cd worker && npm install && npm run check` e deploy command `cd worker && npx wrangler deploy`. Um novo commit na branch principal dispara o build. A implantação real depende das permissões do GitHub na Cloudflare; confira o registro do build antes de presumir sucesso.

A URL de retorno cadastrada no Mercado Livre deve ser exatamente `https://achados-meli-oauth.andreischlittler1818.workers.dev/oauth/callback`. O callback só funcionará após o Worker do repositório ser publicado e os segredos configurados.

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

## Explorar produtos (MVP)

O Worker expõe dois endpoints autenticados com `x-owner-key`, consumidos exclusivamente pelo ACHADOS via CORS:

- `GET /api/products/search?q=...`: pesquisa de produtos no catálogo via `/products/search?site_id=MLB&status=active&q=...`. Pode retornar catálogos incompletos ou bloqueados, conforme permissões da API.
- `GET /api/products/item?id=MLB123456789`: consulta um anúncio específico em `/items/{id}`.

A aba **Mercado Livre** apresenta resultados com foto, preço quando disponível e identificação. Para cadastrar, o usuário **precisa** inserir o link comissionado que gerou no Hub de Afiliados, validá-lo e conferir os dados. A consulta não confirma comissão, elegibilidade, preço atual no momento da futura divulgação, nem cria links rastreados. Não usa scraping nem servidores terceiros não autorizados.

A busca requer conexão OAuth existente e chave administrativa informada na sessão. Os dados cadastrados continuam no navegador (`localStorage`).

## Gerar link de afiliado — fluxo assistido

Na aba **Mercado Livre**, após escolher um produto em **Explorar produtos**, clique **Associar link de afiliado**. O formulário ficará visível acima dos resultados, com os botões:

1. **Copiar URL do anúncio:** disponível apenas quando a API oficial fornece um permalink (um produto de catálogo pode não ter um anúncio específico).
2. **Ver anúncio:** abre a página do anúncio numa nova aba, quando disponível.
3. **Abrir Central de Afiliados:** abre o Hub oficial do Mercado Livre. Faça login, confirme a elegibilidade e gere o link comissionado por lá.
4. Cole o link `meli.la` ou `mercadolivre.com.br` gerado na sua conta e clique **Associar ao ACHADOS**. O cadastro abre o formulário em Produtos para conferir imagem, título e preço antes de salvar.

O ACHADOS **não** gera comissão por API, não substitui links normais por comissionados e não tem acesso garantido à seleção privada do Hub. Preserve o link comissionado original fornecido pelo Mercado Livre.

## Informações comerciais e comissão estimada

A pesquisa por palavras-chave retorna **fichas técnicas** do catálogo, sem preço ou percentual de comissão. Para anúncios comerciais MLB a consulta usa `/items/{id}/sale_price?context=channel_marketplace` e, se indisponível, tenta `/items/{id}/prices`. Quando a API oferece `amount` e `regular_amount`, o sistema calcula o desconto percentual. Preços podem variar conforme o contexto e as permissões da API.

O Programa de Afiliados ainda **não disponibilizou ao ACHADOS uma API oficial documentada de percentuais individuais de comissão**. No formulário de cadastro, informe manualmente a taxa exibida para aquele produto no seu Hub. O sistema calcula somente uma **estimativa matemática** de comissão por venda elegível (preço × percentual), não lucro nem receita efetiva, que dependem da validação e regras do Mercado Livre. Sem taxa, não mostra valor estimado. Confirme os valores antes de publicar.

## Busca de anúncios comerciais (nova versão)

A busca principal de produtos em **Mercado Livre → Explorar produtos** utiliza `GET /sites/MLB/search?q=...` por meio de `/api/products/listings`, permitindo consultar anúncios comerciais quando a API os disponibiliza à aplicação. Cada resultado indica preço e desconto apenas quando recebidos da API; valores podem variar conforme o contexto do consumidor.

A opção alternativa **Pesquisar fichas de catálogo** mantém o recurso `/products/search`, que normalmente não apresenta preço de oferta. Em uma ficha de catálogo, o botão **Ver oferta comercial deste catálogo** utiliza `/products/{id}` e, quando presente, `buy_box_winner.item_id` para consultar o anúncio com `/items/{id}` e tentar obter preço via `/items/{id}/sale_price`. Nem todo produto possui buy box ou oferta consultável. Erros 403/404 são informados sem simular disponibilidade.

**Essas consultas não garantem produto elegível a comissão.** Para divulgar, o usuário deve confirmar o produto no Hub de Afiliados, gerar seu link comissionado oficial e associá-lo no ACHADOS. O percentual de comissão continua informado manualmente pelo usuário.
