# RemoteJobsBR

Site de vagas remotas internacionais para aplicantes brasileiros.

## Tecnologias

- **Frontend**: Next.js com TypeScript
- **Backend**: API Routes do Next.js
- **Banco de Dados**: PostgreSQL com Prisma ORM
- **Estilização**: Tailwind CSS
- **Autenticação**: NextAuth.js
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

4. Configure o banco de dados:
   ```bash
   npx prisma migrate dev --name init
   # ou
   yarn prisma migrate dev --name init
   ```

5. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   # ou
   yarn dev
   ```

6. Acesse o site em [http://localhost:3000](http://localhost:3000)

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