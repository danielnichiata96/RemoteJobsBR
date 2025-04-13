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
*   [x] **Integrations:** Refatorar `fetchGreenhouseJobs.ts` - Mover config. hardcoded para arquivo de configuração. (Completed - Now uses DB)
*   [x] **Integrations:** Melhorar tratamento de erros nos scripts de fetch de vagas. (Basic improvements done)
*   [x] **Integrations:** Desenvolver framework de scraping para novas fontes de vagas. (Foundation Complete - Fetcher/Processor/Adapter pattern established)
*   [x] **Integrations:** Implementar integração com nova plataforma de vagas. (On Hold - Pending Framework Refinement & Approval)
*   [x] **Testing:** Fix `Pagination` test.
*   [x] **Testing:** Adicionar testes unitários para lógica de filtragem do fetcher. (On Hold - Pending Filter Refinement)
*   [x] **Optimization:** Implementar camada de cache para listagens de vagas frequentemente acessadas (API Cache Implemented and Tested)
*   [x] **Integrations:** Refinar lógica de filtragem de vagas remotas/LATAM no `GreenhouseFetcher`. (Completed - 2025-04-15)
*   [x] **Integrations:** Investigar e corrigir erros de fetch para fontes Greenhouse (Plaid, Revolut, Wise, 1Password, Articulate, etc.). (Completed - 2025-04-15)

## Phase 2: Growth & Enhanced Features (Current)

*   [x] Selecionar primeiras tarefas para Phase 2 (priorizar do backlog).
*   [ ] Planejar próximos passos de desenvolvimento após integrações.
*   [ ] Revisar arquitetura para suportar recursos adicionais da Phase 2.

### Phase 2.1: Job Integrations & Fetch Enhancement
*   [x] **Core:** Refatorar `fetchGreenhouseJobs.ts` para usar configuração externa (DB/arquivo).
*   [x] **Core:** Implementar sistema robusto de tratamento de erros nos scripts de fetch.
*   [x] **Core:** Criar framework modular para adicionar novas fontes de vagas. (Foundation Complete - Fetcher/Processor/Adapter pattern)
*   [x] **Core:** Adicionar múltiplas fontes Greenhouse via script (`addBulkJobSources.ts`).
*   [x] **Core:** Implementar integração com **AshbyHQ** usando a **API JSON oficial (`posting-api/job-board`)**. *(New Priority - 2025-04-15)*
    *   [x] Criar `AshbyFetcher.ts` e `AshbyProcessor.ts`.
    *   [x] Configurar `JobSource` para usar `config: { jobBoardName: '...' }`.
    *   [x] Implementar `_isJobRelevant` no `AshbyProcessor` (priorizar `isRemote`, `location`, `address`, `secondaryLocations`).
    *   [x] Mapear dados JSON do Ashby para `StandardizedJob` no `AshbyProcessor`.
    *   [x] Filtrar vagas com `isListed: false` no `AshbyProcessor`.
    *   [x] **Debugging:** Investigar por que as fontes Ashby não estão processando jobs (verificar URL da API, formato da resposta, etc). *(New - 2025-04-16) -> Fixed - URL API & Processor Logic Corrected*
    *   [ ] **Refinement:** Implementar funções `parseDate` e `cleanHtml` ausentes (usadas temporariamente com `new Date()` e HTML bruto). *(New - 2025-04-16)*
    *   [ ] **Refinement:** Refatorar `AshbyProcessor` para usar config externa para keywords de localização (como Greenhouse). *(New - 2025-04-16)*
*   ~~[ ] **Integrations/Lever:** Testar `LeverFetcher` com fontes reais e identificar falhas/pontos de melhoria. (New - 2025-04-15)~~ (Removed LeverFetcher - 2025-04-15)
*   [x] **Testing:** Fix `Pagination` test.
*   [ ] **Testing:** Criar testes unitários para lógica de filtragem do `GreenhouseFetcher`. *(Ready)*
*   [ ] **Testing:** Criar testes unitários para lógica de `AshbyFetcher` e `AshbyProcessor`. *(Ready - New 2025-04-16)*
*   [x] **Performance:** Adicionar cache para resultados de busca de vagas frequentes. (API Cache Implemented and Tested)
*   [x] **Filtering:** Refinar palavras-chave e lógica em `greenhouse-filter-config.json` e `GreenhouseFetcher` para maior precisão (LATAM/Remote). (Completed - 2025-04-15)
*   [x] **BugFix:** Investigar e corrigir erros 404 e outros durante `npm run fetch-jobs`. (Completed - 2025-04-15)

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
*   [x] **Filters:** Add Salary Range filter.
*   [x] **Filters:** Add Company filter. (Completed)
*   [ ] **Filters:** Add Geographic restrictions filter (e.g., states in Brazil).
*   [ ] **Filters:** Add Language requirements filter.
*   [ ] **Filters:** Implement text search for job listings with result highlighting.
*   [ ] **Filters:** Implement infinite scroll/lazy loading for job list pagination.
*   [ ] **Filters:** Show popular filter tags based on usage.
*   [ ] **Integrations:** Add more job board integrations (LinkedIn API, Indeed API, etc.).
*   [ ] **Integrations:** Implement job scraping framework for other aggregators (requires careful legal review).
*   [ ] **Integrations:** Implement standard API for companies to post jobs directly.
*   [x] **Integrations:** Refactor `fetchGreenhouseJobs.ts` filtering logic (move hardcoded `DEFAULT_FILTER_CONFIG` to DB/config file). (Done - uses external config file now)
*   [x] **Integrations:** Improve reliability/error handling of job fetching scripts. (Completed - 2025-04-15)
*   [x] **Integrations:** Improve content section extraction logic in `fetchGreenhouseJobs.ts`. (Completed - 2025-04-15)
*   [ ] **Testing Gap:** Create E2E test setup for critical user flows (job search, job click tracking)
*   [ ] **Testing Gap:** Add Unit Tests for `GreenhouseFetcher.ts` filtering logic *(Ready)*
*   [ ] **Testing Gap:** Add Unit Tests for `AshbyFetcher.ts` and `AshbyProcessor.ts` filtering logic (after implementation)
*   [ ] **Tech Debt:** Implement proper error handling for API routes
*   [x] **Tech Debt:** Refactor large pages (profile.tsx has 735 lines) into smaller components (Completed)
*   [x] **Optimization:** Add caching layer for frequently accessed job listings (Completed - API Cache)
*   [ ] **Security:** Add rate limiting for authentication endpoints
*   [ ] **Security:** Implement CSRF protection for sensitive operations
*   [ ] **Security:** Implement rate limiting for job search API endpoints
*   [ ] **Documentation:** Create API documentation for endpoints
*   [ ] **i18n:** Prepare codebase for proper internationalization (currently has i18n config but might need structure)
*   [x] **Bug Fix:** Improve error handling in job detail page (`src/pages/jobs/[id].tsx`) for missing fields and invalid dates. (Completed)
*   [x] **Bug Fix:** Fix company logos not displaying correctly on job cards. (Completed 2025-04-12)

## Milestones

*   [x] **Milestone: MVP Setup Complete** (Initial Project, DB, Auth Setup)
*   [x] **Milestone: Core Job Board Functional** (Posting, Listing, External Links, Greenhouse Sync)
*   [x] **Milestone: Dashboards & Click Tracking** (User Favorites, Recruiter Analytics)
*   [x] **Milestone: Core MVP Launch Ready** (Phase 1 items complete, tested, deployed)
*   [ ] **Milestone: Enhanced Search & Growth Foundation** (Phase 2 items like skills filter, SEO basics)

## Recently Completed

*   **2025-04-12:** Fix company logo display issue by adding `companyWebsite` to `JobSource`, updating fetcher/processor logic, and ensuring API token is used correctly.
*   **2025-04-12:** Created script `addBulkJobSources.ts` to add/update multiple Greenhouse sources.
*   **2025-04-12:** Corrected `JobSource` type usage in `addBulkJobSources.ts`.
*   **2025-04-12:** Fixed import path alias issue in `greenhouseProcessor.ts`.
*   **2025-04-12:** Created script `addJobSource.ts` for adding single Greenhouse sources.
*   **2025-04-12:** Corrected salary field mapping in `jobProcessingService.ts`.
*   **2025-04-15:** Fix widespread test suite failures (polyfill, Lever processor/fetcher assertions, Prisma mock init).
*   **2025-04-15:** Refactor profile.tsx using ProfileForm/ProfileView components, fixed related bugs.
*   **2025-04-14:** Refactor `profile.tsx` into `ProfileForm` and `ProfileView` components, including tests.
*   **2025-04-14:** Implement Company filter (UI, state, API, tests).
*   **2025-04-14:** Verified Job Detail Page external link UX improvements were already implemented.
*   **2025-04-14:** Improve error handling in job detail page (`src/pages/jobs/[id].tsx`) for missing fields/invalid dates and add tests.
*   **2025-04-14:** Fix `Pagination` test - recreated missing component file and updated test file.
*   **2025-04-14:** Implementar camada de cache para listagens de vagas frequentemente acessadas usando `node-cache`.
*   **2025-04-12:** Implementar Error Monitoring com Sentry (configuração completa, utilitários, error boundary e integração com NextAuth).
*   **2025-04-11:** Adicionar testes para componente de Paginação.
*   **2025-04-11:** Implementar testes unitários para lógica de autenticação (NextAuth).
*   **2025-04-11:** Add tests for SaveJobButton, saved-jobs page, and saved jobs API endpoints.
    *   `SaveJobButton.test.tsx`, `saved-jobs.test.tsx`, `