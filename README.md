# Central de Afiliados — MVP v0.1

Aplicativo React + TypeScript para cadastro de produtos do Mercado Livre, composição de posts e agendamento demonstrativo para Instagram, Telegram e WhatsApp.

> **ATENÇÃO:** Esta é uma versão local de demonstração funcional do fluxo editorial. Não há API conectada, não publica posts, não consulta preços ou links do Mercado Livre e **não executa agendamentos automaticamente**. Os dados são persistidos apenas no `localStorage` do navegador. Os dois produtos iniciais são **fictícios** e não contêm links de afiliado.

## Iniciar

Requer Node.js 18 ou superior.

```bash
npm install
npm run dev
```

Acesse o endereço mostrado no terminal (normalmente http://localhost:5173). Para compilar:

```bash
npm run build
npm run preview
```

## Publicar código no GitHub

Crie um repositório vazio no GitHub e, na pasta do projeto, execute (substituindo SEU_USUARIO/SEU_REPOSITORIO):

```bash
git init
git add .
git commit -m "MVP central de afiliados"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

O GitHub Pages pode hospedar a interface estática, mas **não** executará o servidor de publicação, cron jobs ou guardará credenciais de APIs. Para isso, implantar backend seguro separado.

## Fluxo disponível

- **Painel:** totais locais e últimos rascunhos.
- **Produtos:** cadastrar, editar, remover, abrir link; campos para preço, imagem e link HTTPS de afiliado.
- **Posts:** criar texto por modelos locais, editar, copiar, salvar e reutilizar; aviso `#Publicidade #LinkDeAfiliado`.
- **Agendamentos:** registrar e cancelar horários locais; status **Aguardando integração**, sem disparo.
- **Canais:** documenta requisitos; indica **Não conectado**.
- **Configurações:** informações do modo demo e exportação JSON de backup.

## Próxima etapa: arquitetura de produção

1. Autenticação de usuários (por exemplo Supabase Auth), PostgreSQL e Row Level Security. Tabelas: `products`, `posts`, `channels`, `schedules`, `publishing_logs`, `settings`, `users`.
2. Backend seguro para segredos e tokens, OAuth/autorização por canal, criptografia em repouso e mecanismos de renovação. Nunca incluir chaves em código cliente nem no repositório.
3. Serviço de filas e agendador com fuso `America/Sao_Paulo`, tratamento de horário de verão, idempotência, limitação de taxa, logs de erro, retentativas e cancelamento.
4. Adaptadores de APIs oficiais: Telegram Bot API (bot administrador do canal), Instagram Graph API (conta profissional e permissões aprovadas), WhatsApp Business Platform (somente mensagens permitidas, consentimento e modelos quando aplicável). Não implementar automação de grupos pessoais de WhatsApp.
5. Mercado Livre: o usuário insere links de afiliado gerados pela Central de Afiliados. Eventual geração automática de links e consulta ao painel dependerá de disponibilidade e autorização de API oficial. Não fazer scraping do painel.
6. Gerador de IA real opcional via chamada protegida a um provedor, com revisão de anúncios e transparência sobre promoções; checar preço e validade antes de publicar.
7. Testes de integração e segurança antes de ativar envio real. Registrar evidência de sucesso somente após confirmação do provedor.

## Avisos

Preços dos produtos de exemplo não são preços atuais. O agendamento não realiza disparos. Dados no navegador podem ser perdidos ao limpar o armazenamento. O gerenciamento automático real **não é possível apenas com uma página estática do GitHub**.

## Importar links de afiliado (v0.2)

1. Na sua conta de afiliado do Mercado Livre, use o gerador oficial e copie o link comissionado.
2. Abra **Produtos > Importar link de afiliado** no ACHADOS.
3. Cole a URL HTTPS original e clique em **Importar link**. São aceitos domínios oficiais do Mercado Livre e o encurtador `meli.la`.
4. Confira o formulário: complete **nome, preço e demais dados** manualmente. Imagens e preços **não** são coletados automaticamente. Clique em **Salvar produto**.
5. Use **Criar post** para gerar um texto contendo a URL original preservada, inclusive parâmetros de rastreamento. Copie a URL cadastrada pelo botão disponível no cartão do produto.

A validação apenas confere o domínio e o protocolo HTTPS; **não garante que o link seja comissionado ou que o produto esteja elegível**. Não são usadas senhas, cookies, scraping, nem uma API de afiliados não documentada. Links duplicados são recusados. O catálogo continua em `localStorage`, sem sincronização entre navegadores. Os produtos demonstrativos devem ser substituídos por links reais.
