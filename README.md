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
- `npm run prisma:studio` - Abre o Prisma Studio para gerenciar o banco de dados

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