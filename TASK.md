# TASK LIST - RemoteJobsBR

<!-- 
Purpose: Tracks current tasks, backlog, and sub-tasks. 
AI Prompt: "Update TASK.md to mark XYZ as done and add ABC as a new task."
LLM should update this file based on conversational progress.
-->

## Current Focus / Active Tasks (What I'm working on NOW)

*   [x] **Phase 1 Complete!** Todas as tarefas da Phase 1: Core UX & Stability foram concluídas.
*   [x] Preparando para Phase 2 - Selecionar próximas prioridades.
*   [x] **Phase 2: Job Integration Focus** - Melhorar sistema de integração de vagas.
*   [x] **Integrations:** Refatorar `fetchGreenhouseJobs.ts` - Mover config. hardcoded para arquivo de configuração.
*   [x] **Integrations:** Melhorar tratamento de erros nos scripts de fetch de vagas.
*   [x] **Integrations:** Desenvolver framework de scraping para novas fontes de vagas. (Foundation Complete)
*   [ ] **Integrations:** Implementar integração com nova plataforma de vagas. (On Hold - Pending Framework Refinement & Approval)
*   [x] **Testing:** Fix `Pagination` test. (JobFilters still On Hold - Blocked by Jest/Env issues)
*   [ ] **Testing:** Adicionar testes unitários para lógica de filtragem do fetcher. (Filter logic tested, On Hold for `processSource` tests)
*   [x] **Optimization:** Implementar camada de cache para listagens de vagas frequentemente acessadas (API Cache Implemented and Tested)

## Phase 2: Growth & Enhanced Features (Current)

*   [x] Selecionar primeiras tarefas para Phase 2 (priorizar do backlog).
*   [ ] Planejar próximos passos de desenvolvimento após integrações.
*   [ ] Revisar arquitetura para suportar recursos adicionais da Phase 2.

### Phase 2.1: Job Integrations & Fetch Enhancement
*   [x] **Core:** Refatorar `fetchGreenhouseJobs.ts` para usar configuração externa (DB/arquivo).
*   [x] **Core:** Implementar sistema robusto de tratamento de erros nos scripts de fetch.
*   [x] **Core:** Criar framework modular para adicionar novas fontes de vagas. (Foundation Complete)
*   [ ] **Core:** Implementar primeira integração adicional (LinkedIn, Indeed, ou similar). (On Hold - Pending Framework Refinement & Approval)
*   [x] **Testing:** Fix `Pagination` test. (JobFilters still On Hold - Blocked by Jest/Env issues)
*   [ ] **Testing:** Criar testes unitários para lógica de filtragem do fetch de vagas. (Filter logic tested, On Hold for `processSource` tests)
*   [x] **Performance:** Adicionar cache para resultados de busca de vagas frequentes. (API Cache Implemented and Tested)

## Future Ideas / Full Backlog (Phase 2 & Beyond)

*   [ ] Feature: Custom Job Alerts System (Filters, Notifications).
*   [ ] Feature: Job Application History (Extend ClickTracking with user view).
*   [ ] Tech: Implement Progressive Web App (PWA) configuration.
*   [ ] Feature: User Onboarding Flow.
*   [ ] Feature: Social Sharing for job listings.
*   [ ] Feature: Implement "Jobs You Might Like" recommendation section.
*   [ ] Revenue: Explore Premium Candidate Features (Subscription).
*   [ ] Feature: Enhance Recruiter/Company Analytics Dashboard.
*   [ ] Revenue: Implement Featured Company Profiles.
*   [ ] Growth: Implement Affiliate Partnership System.
*   [ ] Tech: Implement Automated Job Quality Scoring.
*   [ ] UX: Implement Dark Mode Support.
*   [ ] Admin: Create Performance Metrics Dashboard.
*   [ ] Feature: Enhance job filtering (Skills/Technology).
*   [ ] Feature: Implement Saved Searches for Candidates.
*   [x] ~~Feature: Job Detail Page - Add interactive elements (e.g., save job).~~
*   [x] Feature: Job Detail Page - Melhorar UX para redirecionamento ao site de origem da vaga. (Verified Already Implemented)
*   [ ] Feature: Company Profile Pages.
*   [ ] Feature: Curated Job Recommendations system.
*   [ ] UX: Enhance mobile responsiveness thoroughly.
*   [ ] UX: Implementar estatísticas de cliques para usuários (histórico de vagas visitadas).
*   [ ] Tech: Add Integration Tests.
*   [ ] Tech: Add End-to-End Tests (Playwright/Cypress).
*   [ ] Tech: Optimize database queries & add indexes.
*   [ ] Tech: Implement data analytics tracking for user behavior.
*   [ ] Content: Develop Blog section.
*   [ ] Content: Add resources/guides for remote work from Brazil.
*   [ ] Growth: Implement SEO optimizations.
*   [ ] Growth: Create Referral System.
*   [ ] Revenue: Implement paid job posting plans.
*   [ ] Revenue: Implement featured job listings.
*   [ ] Revenue: Develop partnership features (schools/bootcamps).
*   [ ] Mobile: Consider mobile app development.
*   [ ] **Filters:** Add Salary Range filter.
*   [ ] **Filters:** Add Company filter.
*   [ ] **Filters:** Add Geographic restrictions filter (e.g., states in Brazil).
*   [ ] **Filters:** Add Language requirements filter.
*   [ ] **Filters:** Implement text search for job listings with result highlighting.
*   [ ] **Filters:** Implement infinite scroll/lazy loading for job list pagination.
*   [ ] **Filters:** Show popular filter tags based on usage.
*   [ ] **Integrations:** Add more job board integrations (LinkedIn API, Indeed API, etc.).
*   [ ] **Integrations:** Implement job scraping framework for other aggregators (requires careful legal review).
*   [ ] **Integrations:** Implement standard API for companies to post jobs directly.
*   [ ] **Integrations:** Refactor `fetchGreenhouseJobs.ts` filtering logic (move hardcoded `DEFAULT_FILTER_CONFIG` to DB/config file).
*   [ ] **Integrations:** Improve reliability/error handling of job fetching scripts.
*   [ ] **Integrations:** Improve content section extraction logic in `fetchGreenhouseJobs.ts`.
*   [ ] **Testing Gap:** Create E2E test setup for critical user flows (job search, job click tracking)
*   [ ] **Testing Gap:** Add Unit Tests for ~~`fetchGreenhouseJobs.ts`~~ `GreenhouseFetcher.ts` filtering logic
*   [ ] **Testing Gap:** Add Integration Tests for job fetching scripts (mocking APIs and DB)
*   [ ] **Tech Debt:** Implement proper error handling for API routes
*   [ ] **Tech Debt:** Refactor large pages (profile.tsx has 735 lines) into smaller components 
*   [ ] **Optimization:** Add caching layer for frequently accessed job listings
*   [ ] **Security:** Add rate limiting for authentication endpoints
*   [ ] **Security:** Implement CSRF protection for sensitive operations
*   [ ] **Security:** Implement rate limiting for job search API endpoints
*   [ ] **Documentation:** Create API documentation for endpoints
*   [ ] **i18n:** Prepare codebase for proper internationalization (currently has i18n config but might need structure)
*   [x] **Bug Fix:** Improve error handling in job detail page (`src/pages/jobs/[id].tsx`) for missing fields and invalid dates. (Completed)

## Milestones

*   [x] **Milestone: MVP Setup Complete** (Initial Project, DB, Auth Setup)
*   [x] **Milestone: Core Job Board Functional** (Posting, Listing, External Links, Greenhouse Sync)
*   [x] **Milestone: Dashboards & Click Tracking** (User Favorites, Recruiter Analytics)
*   [x] **Milestone: Core MVP Launch Ready** (Phase 1 items complete, tested, deployed)
*   [ ] **Milestone: Enhanced Search & Growth Foundation** (Phase 2 items like skills filter, SEO basics)

## Recently Completed

*   **2025-04-14:** Verified Job Detail Page external link UX improvements were already implemented.
*   **2025-04-14:** Improve error handling in job detail page (`src/pages/jobs/[id].tsx`) for missing fields/invalid dates and add tests.
*   **2025-04-14:** Fix `Pagination` test - recreated missing component file and updated test file.
*   **2025-04-14:** Implementar camada de cache para listagens de vagas frequentemente acessadas usando `node-cache`.
*   **2025-04-12:** Implementar Error Monitoring com Sentry (configuração completa, utilitários, error boundary e integração com NextAuth).
*   **2025-04-11:** Adicionar testes para componente de Paginação.
*   **2025-04-11:** Implementar testes unitários para lógica de autenticação (NextAuth).
*   **2025-04-11:** Add tests for SaveJobButton, saved-jobs page, and saved jobs API endpoints.
    *   `SaveJobButton.test.tsx`, `saved-jobs.test.tsx`, `api/jobs/saved/[jobId].test.ts`, `api/users/me/saved-jobs.test.ts`
*   **2025-04-10:** Added `/api/jobs/search` tests.
*   **2025-04-10:** Implementar filtro de tecnologias/stack com persistência em URL.
*   **2025-04-09:** Adicionar hook useDebounce e aplicar nos inputs de filtro para otimizar performance.
*   **2025-04-09:** Migrar lógica de filtros para componente `JobFilters.tsx` e adicionar testes.
*   **2025-04-08:** Adicionar botão de "Salvar Vaga" e criação da página de vagas salvas.
*   **2025-04-07:** Melhorar UX da página de detalhe com indicadores claros de redirecionamento externo.
*   **2025-04-07:** Implementar funcionalidade de ordenação (sortBy) para listagem de vagas.
*   **2025-04-06:** Implementar sistema de tracking de cliques em links externos.
*   **2025-04-05:** Expandir testes unitários para utils/services do projeto.
*   **2025-04-04:** Refatorar página de listagem para usar SWR (client-side fetching) com melhor UX.
*   **2025-04-03:** Instalar e configurar Jest para testes unitários.
*   **2025-04-02:** Atualizar schema Prisma e adicionar suporte para URLs externas e tracking.
*   **2025-04-01:** Reconfigurar arquitetura para funcionar como agregador de links (estilo Remotive).

## Completed Phase 1

### Core Infrastructure
*   [x] Setup initial Next.js project structure with TypeScript, Tailwind CSS.
*   [x] Configure Prisma and connect to PostgreSQL database (local setup).
*   [x] Define initial Prisma schema based on `PLANNING.md`.
*   [x] **DB:** Create initial database migration based on schema (`prisma migrate dev`).
*   [x] **Architecture:** Reestruturar o modelo de dados para agregador de links externos.
*   [x] **Code Refactor:** Adaptar código (API Routes, UI, fetch scripts) para o novo schema.

### Authentication & User Features
*   [x] **Auth:** Implement NextAuth.js setup (Email Magic Link, Google, LinkedIn Providers).
*   [x] **Auth:** Create basic registration/login UI flow for Candidates & Recruiters.
*   [x] **User Features:** Implementar sistema de vagas salvas (favoritos) para usuários.
*   [x] **User Features:** Implement click tracking system for external job links.
*   [x] **Notifications:** Setup email service integration.

### Jobs Functionality
*   [x] **Jobs:** Implement basic job listing page (fetching placeholder/manual data).
*   [x] **Jobs:** Implement Job Posting API endpoint (Recruiter role required).
*   [x] **Jobs:** Implement basic Job Posting Form UI (for Recruiters).
*   [x] **Jobs:** Refine Job Listing Page UI (loading skeletons, error handling).
*   [x] **Jobs:** Implement server-side pagination for job listings API.
*   [x] **Jobs:** Improve Job Detail Page with external redirection UX indicators.
*   [x] **Jobs:** Implement sorting functionality for job listings page.
*   [x] **Integration:** Setup Greenhouse job fetching logic (basic script/API route).
*   [x] **Schema:** Adicionar campos para URLs de vagas externas e tracking de cliques.

### Filters & Search
*   [x] **Filters:** Implement URL query parameter state management for filters.
*   [x] **Filters:** Add "Technology/Stack" filter option (Schema, API, UI).
*   [x] **Filters:** Enhance Filter UI/UX (Mobile layout, Chips, Result Count).
*   [x] **Filters:** Implement debounce for filter inputs.

### Dashboard & Analytics
*   [x] **Recruiter Dashboard:** Implement API route to fetch jobs posted by a recruiter.
*   [x] **Recruiter Dashboard:** Reconstruir para focar em métricas de cliques e visualizações.
*   [x] **Analytics:** Implementar sistema de rastreamento de cliques em vagas externas.

### Testing & Monitoring
*   [x] **Testing:** Setup basic Unit Testing Framework (Jest).
*   [x] **Testing:** Create first component tests for jobs listing page.
*   [x] **Testing:** Write basic API route tests for job fetching.
*   [x] **Testing:** Expand test coverage for utility functions.
*   [x] **Testing:** Add mock configuration for NextAuth sessions and protected routes.
*   [x] **Testing:** Add component tests for `JobFilters.tsx` and Pagination.
*   [x] **Testing:** Write initial unit tests for Auth logic.
*   [x] **Testing:** Add unit tests for `useTrackJobClick` hook and related endpoints.
*   [x] **Monitoring:** Setup basic Error Monitoring (Sentry integration).

### Refactoring
*   [x] **Refactor:** Move filter UI/logic from `index.tsx` to `JobFilters.tsx` component.
*   [x] **Refactor:** Refactor jobs listing page to use client-side fetching (SWR).
*   [x] **Refactor:** Migrate job listing functionality from `/jobs` page to home page (`/`).

## Bug Fixes

*   [x] **React Error:** Fix "Objects are not valid as a React child (found: object with keys {name, logo})" error occurring on page load (likely home page). (Reported: {Current Date})

### 📈 Analytics & Tracking 