# RemoteJobsBR

Site de vagas remotas internacionais para aplicantes brasileiros.

## Tecnologias

- **Frontend**: Next.js com TypeScript
- **Backend**: API Routes do Next.js
- **Banco de Dados**: PostgreSQL com Prisma ORM
- **Estilização**: Tailwind CSS
- **Autenticação**: NextAuth.js
- **Monitoramento de Erros**: Sentry
- **Hospedagem**: Vercel

## Requisitos

- Node.js 18.0.0 ou superior
- npm ou yarn
- PostgreSQL (local ou hospedado)

## Configuração Inicial

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/remotejobsbr.git
   cd remotejobsbr
   ```

2. Instale as dependências:
   ```bash
   npm install
   # ou
   yarn
   ```

3. Configure as variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```
   Edite o arquivo `.env` com suas configurações.
   **Variáveis importantes:**
   - `DATABASE_URL`: String de conexão do PostgreSQL.
   - `NEXTAUTH_URL`: URL base da aplicação (ex: http://localhost:3000).
   - `NEXTAUTH_SECRET`: Chave secreta para NextAuth (gere uma aleatória).
   - `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`: Configurações do Sentry (opcional).
   - `FETCH_CONCURRENCY`: (Opcional) Número de fontes de vagas a processar em paralelo pelo script `fetch-jobs`. Default: 5.

4. Configure o Sentry (opcional, mas recomendado para produção):
   - Crie uma conta no [Sentry](https://sentry.io)
   - Crie um projeto Next.js
   - Adicione o DSN no arquivo `.env`:
     ```
     NEXT_PUBLIC_SENTRY_DSN=seu-dsn-do-sentry
     SENTRY_ORG=seu-slug-da-organização
     SENTRY_PROJECT=seu-slug-do-projeto
     ```

5. Configure o banco de dados:
   ```bash
   npx prisma migrate dev --name init
   # ou
   yarn prisma migrate dev --name init
   ```

6. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   # ou
   yarn dev
   ```

7. Acesse o site em [http://localhost:3000](http://localhost:3000)

## Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Gera a versão de produção
- `npm start` - Inicia o servidor de produção
- `npm run lint` - Executa o linter

### Scripts de Banco de Dados e Manutenção

- `npm run prisma:studio` - Abre o Prisma Studio para gerenciar o banco de dados.
- `npm run fetch-jobs` - Executa o script `src/scripts/fetchJobSources.ts` para buscar novas vagas das fontes configuradas. A concorrência pode ser definida pela variável de ambiente `FETCH_CONCURRENCY` (default: 5).
- `npm run deactivate-stale-jobs` - Executa `scripts/deactivateStaleJobs.ts` para marcar vagas antigas como inativas (CLOSED).
- `npm run add-bulk-sources` - Executa `src/scripts/addBulkJobSources.ts` para adicionar/atualizar múltiplas fontes Greenhouse definidas no script.
- `npm run list-sources` - Executa `src/scripts/listJobSources.ts` para listar as fontes de vagas configuradas no banco de dados.
- `npm run clean-db` - Executa `src/scripts/cleanDatabase.ts` (Propósito exato a confirmar - limpeza geral do DB).
- `npm run fix-jobs` - Executa `src/scripts/fixJobSources.ts` (Propósito exato a confirmar - correção de dados de fontes).

## Utility Scripts

Detailed information on available utility scripts:

*   `npm run fetch-jobs`: Executes `src/scripts/fetchJobSources.ts` to fetch new jobs from all enabled sources. Concurrency is configurable via the `FETCH_CONCURRENCY` environment variable (defaults to 5).
*   `npm run deactivate-stale-jobs`: Executes `scripts/deactivateStaleJobs.ts` to mark old job postings (defaulting to those not updated in the last 30 days) as inactive (`CLOSED`). The threshold can be adjusted via the `STALE_JOB_THRESHOLD_DAYS` environment variable.
*   `npm run add-bulk-sources`: Executes `src/scripts/addBulkJobSources.ts` to add or update multiple Greenhouse job sources defined within the script file.
*   `npm run list-sources`: Executes `src/scripts/listJobSources.ts` to display currently configured job sources in the database.
*   `npm run backfill-normalized`: Executes `scripts/backfillNormalizedFields.ts` to populate the `normalizedCompanyName` field for existing Company users and the `normalizedTitle` field for existing Jobs where these fields are currently `null`. This is useful after initial setup or schema changes.
*   `npm run prisma:studio`: Opens Prisma Studio, a GUI tool for direct database inspection and modification.
*   `npm run clean-db`: *Purpose needs clarification/implementation.* Executes `src/scripts/cleanDatabase.ts`.
*   `npm run fix-jobs`: *Purpose needs clarification/implementation.* Executes `src/scripts/fixJobSources.ts`.

## Estrutura do Projeto

```
remotejobsbr/
├── src/
│   ├── components/ - Componentes reutilizáveis
│   ├── pages/ - Páginas e API routes
│   ├── lib/ - Utilitários e configurações
│   ├── styles/ - Arquivos CSS e configuração do Tailwind
│   ├── hooks/ - React hooks personalizados
│   └── types/ - Definições de tipos TypeScript
├── prisma/ - Schema e migrações do banco de dados
└── public/ - Arquivos estáticos
```

## Deployment

O projeto está configurado para deploy automático na Vercel a partir do repositório GitHub. Cada push para a branch `main` inicia um novo deploy.

## Licença

MIT 

## Monitoramento de Erros com Sentry

O projeto utiliza Sentry para monitoramento de erros e performance. A integração inclui:

- Captura automática de erros no frontend e backend
- Rastreamento de performance
- Captura de informações de contexto (usuário, sessão)
- Rastreamento de migalhas de pão (breadcrumbs)

Para utilizar o Sentry em desenvolvimento:

1. Certifique-se de que as variáveis de ambiente do Sentry estão configuradas
2. Os erros serão automaticamente capturados e enviados
3. Use as funções de utilidade em `src/lib/sentry.ts` para relatar erros manualmente:

```typescript
import { captureException } from '@/lib/sentry';

try {
  // código que pode falhar
} catch (error) {
  captureException(error);
}
```

Para API routes, use o wrapper de manipulador de erros:

```typescript
import { withErrorHandler } from '@/lib/apiErrorHandler';

export default withErrorHandler(async (req, res) => {
  // lógica da API aqui
});
``` 