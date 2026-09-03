# Operação da beta pública

Este runbook cobre a operação gratuita e não comercial no Brasil. Antes de qualquer monetização,
migre a hospedagem para um plano que permita uso comercial.

## Configuração obrigatória

Na Vercel, configure `APP_URL`, banco e Supabase já usados pelo app, além de `CRON_SECRET`,
`HEALTHCHECK_SECRET`, `VITE_TURNSTILE_SITE_KEY`, `VITE_SENTRY_DSN`, `SENTRY_DSN`,
`SENTRY_AUTH_TOKEN`, `SENTRY_ORG` e `SENTRY_PROJECT`. Use valores aleatórios diferentes para os
dois secrets operacionais. Nunca use variáveis `VITE_*` para segredos.

No Supabase Auth, habilite Cloudflare Turnstile com a chave secreta correspondente. O widget do app
protege cadastro, login por senha e recuperação; o Google OAuth não usa um segundo CAPTCHA.

No Sentry, crie alertas para novos erros e regressões. Mantenha Replay desativado e revise a
sanitização sempre que novos campos forem adicionados à API. Erros são amostrados integralmente;
traces usam 10%.

## Saúde e manutenção

- `GET /api/health` verifica apenas a função.
- `GET /api/health?deep=1`, com `Authorization: Bearer <HEALTHCHECK_SECRET>`, também verifica o banco.
- A Vercel chama diariamente `/api/maintenance/account-deletions` com `CRON_SECRET` e processa até
  25 contas vencidas. Falhas ficam registradas e são tentadas novamente.

O `x-request-id` permite correlacionar resposta, logs da Vercel e evento no Sentry. Nunca registre
tokens, e-mails, descrições, SQL ou URLs assinadas em diagnóstico.

## Backup

Cadastre no GitHub Actions os secrets `SUPABASE_DB_URL`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` e `BACKUP_ENCRYPTION_PASSPHRASE`. O workflow
`Production backup` executa diariamente e também pode ser iniciado manualmente. Ele exporta roles,
schema, dados e objetos privados de avatar/logo, cifra o pacote antes do upload e retém somente o
artefato criptografado por sete dias.

No primeiro dia de cada mês — e em toda execução manual — o workflow restaura o dump em um
PostgreSQL temporário e falha se o restore não for válido. Uma falha de backup ou restore bloqueia
novos cadastros até correção.

## Restauração

1. Baixe o artefato mais recente e confirme que ele tem no máximo sete dias.
2. Descriptografe em uma máquina controlada:
   `openssl enc -d -aes-256-cbc -pbkdf2 -in backup.tar.gz.enc -out backup.tar.gz -pass env:BACKUP_ENCRYPTION_PASSPHRASE`.
3. Extraia o arquivo em um diretório temporário e valide `SHA256SUMS`.
4. Restaure `roles.sql`, `schema.sql` e `data.sql`, nessa ordem, em um projeto vazio.
5. Reenvie os arquivos listados em `storage/manifest.json` aos buckets privados correspondentes.
6. Faça smoke test de login, workspace, timer, relatório, convite, exportação e exclusão antes de
   apontar tráfego ao ambiente restaurado.
7. Apague com segurança os arquivos descriptografados ao concluir.

## Critérios de liberação e interrupção

Abra gradualmente para 10, 50 e então todos os usuários da beta. Pause novos cadastros quando erros
5xx excederem 1%, qualquer backup falhar ou uma cota mensal gratuita alcançar 70%. O provedor padrão
de e-mail do Supabase é adequado apenas para baixo volume; domínio próprio e SMTP são pré-requisitos
para divulgação em escala.
