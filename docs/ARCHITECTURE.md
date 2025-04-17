# Arquitetura do Projeto: RemoteJobsBR

Este documento descreve a arquitetura geral, as tecnologias utilizadas e o fluxo de dados do sistema RemoteJobsBR.

## 1. Visão Geral

O RemoteJobsBR é um agregador de vagas de emprego 100% remotas, focado em oportunidades internacionais relevantes para profissionais brasileiros. Ele coleta vagas de diversas fontes (APIs de ATS como Greenhouse), processa, normaliza, e armazena essas vagas em um banco de dados, apresentando-as aos usuários através de uma interface web construída com Next.js.

## 2. Tecnologias Principais

*   **Framework:** Next.js (React)
*   **Linguagem:** TypeScript
*   **Banco de Dados:** PostgreSQL
*   **ORM:** Prisma
*   **Estilização:** Tailwind CSS
*   **Autenticação:** NextAuth.js
*   **Scripts:** Node.js (executados com `ts-node`)
*   **Log:** Pino
*   **Requisições HTTP:** Axios
*   **Processamento Assíncrono:** `p-map` (para paralelização de fetches)

## 3. Estrutura de Diretórios (Visão Geral)

```
remotejobsbr/
├── src/
│   ├── components/      # Componentes React reutilizáveis
│   ├── pages/           # Páginas Next.js (incluindo rotas de API em /api)
│   ├── lib/             # Lógica central da aplicação
│   │   ├── adapters/      # Adaptadores (ex: JobProcessingAdapter)
│   │   ├── fetchers/      # Implementações de busca de vagas (GreenhouseFetcher)
│   │   ├── jobProcessors/ # Implementações de processamento de vagas (GreenhouseProcessor)
│   │   ├── services/      # Serviços de negócio (JobProcessingService)
│   │   ├── utils/         # Funções utilitárias (job, date, text, logo)
│   │   └── prisma.ts      # Instância do cliente Prisma
│   ├── styles/          # CSS global, config Tailwind
│   ├── hooks/           # Hooks React customizados
│   └── types/           # Definições TypeScript (ex: StandardizedJob)
├── prisma/              # Schema do banco, migrações, seeds
├── public/              # Assets estáticos
├── tests/               # Testes unitários e de integração (espelhando src/)
├── scripts/             # Scripts autônomos (fetch, manutenção de BD)
├── config/              # Arquivos de configuração (ex: filtros)
├── docs/                # Documentação do projeto
└── ...                  # Arquivos de configuração raiz
```

## 4. Fluxo de Dados Principal (Busca de Vagas)

1.  **Execução do Script (`fetchJobSources.ts`):**
    *   Iniciado via `npm run fetch-jobs`.
    *   Obtém todas as `JobSource` ativas do banco de dados.
    *   Usa `p-map` para processar múltiplas fontes em paralelo (concorrência definida por `FETCH_CONCURRENCY`).
2.  **Seleção do Fetcher (`FetcherFactory`):**
    *   Com base no `type` da `JobSource` (`GREENHOUSE`), seleciona a implementação `JobFetcher` correspondente.
3.  **Execução do Fetcher (`processSource`):**
    *   Cada fetcher (ex: `GreenhouseFetcher`) busca dados brutos da API da fonte.
    *   **Filtragem (`_isJobRelevant`):** Aplica regras de filtragem (keywords de localização, padrões de rejeição) para determinar se a vaga bruta é relevante (100% remota, adequada para LATAM/Global). _Ver `docs/filtering-logic.md` para detalhes._
    *   Coleta os `sourceId` de todas as vagas encontradas na fonte.
    *   Para vagas relevantes, chama o `JobProcessingAdapter`.
4.  **Processamento da Vaga (`JobProcessingAdapter.process`):**
    *   Recebe a vaga bruta relevante do Fetcher.
    *   Seleciona o `JobProcessor` apropriado (ex: `GreenhouseProcessor`) com base no `source` da vaga.
    *   Chama o método `processJob` do Processor.
5.  **Mapeamento no Processor (`processJob` e `_mapToStandardizedJob`):**
    *   O Processor (ex: `GreenhouseProcessor`) valida a vaga bruta.
    *   Mapeia os dados brutos para a estrutura `StandardizedJob`, limpando HTML (`stripHtml`), extraindo skills (`extractSkills`), detectando nível de experiência (`detectExperienceLevel`), etc.
    *   Retorna o `StandardizedJob` parcial (sem ID do banco) para o Adapter.
6.  **Salvar no Banco (`JobProcessingService.saveOrUpdateJob`):**
    *   O Adapter passa o `StandardizedJob` para o `JobProcessingService`.
    *   O Serviço encontra ou cria a `Company` (representada pelo model `User` com `role=COMPANY`).
    *   Realiza um `upsert` na tabela `Job` usando `source` e `sourceId` como chave única, criando ou atualizando a vaga no banco de dados.
7.  **Desativação de Vagas (`JobProcessingService.deactivateJobs`):**
    *   Após processar todas as fontes de um tipo (ex: todas as Greenhouse), o script `fetchJobSources` chama `deactivateJobs` passando o conjunto de `sourceId` encontrados naquela execução.
    *   O serviço marca como `CLOSED` todas as vagas `ACTIVE` daquele `source` que *não* estavam no conjunto de `sourceId` encontrados (indicando que a vaga foi removida da fonte original).

## 5. Outros Fluxos Importantes

*   **API de Busca (`/api/jobs/search`):** Permite a busca e filtragem de vagas pela interface web. Implementa paginação e cache (server-side com `node-cache`).
*   **Autenticação:** Gerenciada pelo NextAuth.js, com usuários (Candidatos e Empresas) armazenados na tabela `User`.
*   **Script de Desativação (`deactivateStaleJobs.ts`):** Marca vagas `ACTIVE` que não foram atualizadas recentemente como `CLOSED`. 