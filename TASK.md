# TASK LIST - RemoteJobsBR

<!-- 
Purpose: Tracks current tasks, backlog, and sub-tasks. 
AI Prompt: "Update TASK.md to mark XYZ as done and add ABC as a new task."
LLM should update this file based on conversational progress.
-->

## Current Focus / Active Tasks (What I'm working on NOW)

*   [x] **Performance:** Paralelizar Execução de Múltiplas Fontes no `fetch-jobs`. (Completed - Made concurrency configurable via `FETCH_CONCURRENCY`, default 5) - 2025-04-21
*   [x] **Documentation:** Documentar Lógica de Filtro (Greenhouse & Ashby). (Completed - Created docs/filtering-logic.md) - 2025-04-21
*   [x] **Filtering:** Análise Contextual de Localização Avançada (ex: "Remote (US Only)"). (Completed - Added pattern detection util and integrated into fetchers) - 2025-04-21

## Next Tasks To Consider
*   [ ] **Integrations/Deduplication:** Implementar Lógica Básica de Desduplicação de Vagas.
*   [ ] **Admin/Monitoring:** Criar Painel de Saúde das Fontes (`JobSource Health Dashboard`).

## Phase 2: Growth & Enhanced Features (Current)

*   [x] Selecionar primeiras tarefas para Phase 2 (priorizar do backlog).
*   [ ] Planejar próximos passos de desenvolvimento após integrações.
*   [ ] Revisar arquitetura para suportar recursos adicionais da Phase 2.

### Phase 2.1: Job Integrations & Fetch Enhancement
*   [x] **Core:** Refatorar `fetchGreenhouseJobs.ts` para usar configuração externa (DB/arquivo).
*   [x] **Core:** Implementar sistema robusto de tratamento de erros nos scripts de fetch.
*   [x] **Core:** Criar framework modular para adicionar novas fontes de vagas. (Foundation Complete - Fetcher/Processor/Adapter pattern)
*   [x] **Core:** Adicionar múltiplas fontes Greenhouse via script (`addBulkJobSources.ts`).
*   [x] **Core:** Implementar integração com **AshbyHQ** usando a **API JSON oficial (`posting-api/job-board`)**. *(Completed - 2025-04-16)*
    *   [x] Criar `AshbyFetcher.ts` e `AshbyProcessor.ts`.
    *   [x] Configurar `JobSource` para usar `config: { jobBoardName: '...' }`.
    *   [x] Implementar `_isJobRelevant` no `AshbyProcessor` (priorizar `isRemote`, `location`, `address`, `secondaryLocations`).
    *   [x] Mapear dados JSON do Ashby para `StandardizedJob` no `AshbyProcessor`.
    *   [x] Filtrar vagas com `isListed: false` no `AshbyProcessor`.
    *   [x] **Debugging:** Investigar por que as fontes Ashby não estão processando jobs (verificar URL da API, formato da resposta, etc). *(Fixed - URL API & Processor Logic Corrected - 2025-04-16)*
    *   [x] **Refinement:** Implementar funções utilitárias `parseDate` e `_stripHtml` (ou `cleanHtml`) e aplicá-las nos Processors (Ashby, Greenhouse). *(Completed - 2025-04-16)*
    *   [x] **Refinement:** Refatorar `AshbyProcessor` para usar config externa para keywords de localização (como Greenhouse). *(Completed - 2025-04-16)*
    *   [x] **Testing:** Fix bugs in `AshbyProcessor` tests (location handling, _isJobRelevant tests). *(Completed - 2025-04-19)*
*   ~~[ ] **Integrations/Lever:** Testar `LeverFetcher` com fontes reais e identificar falhas/pontos de melhoria.~~ (Removed LeverFetcher - 2025-04-15)
*   [x] **Testing:** Fix `Pagination` test.
*   [x] **Testing:** Criar testes unitários para lógica de filtragem do `GreenhouseFetcher`. *(Completed - 2025-04-16)*
*   [x] **Testing:** Criar testes unitários para lógica de `AshbyProcessor._mapToStandardizedJob`. *(Completed - 2025-04-16)*
*   [x] **Integrations/Deactivation: Implementar Detecção/Limpeza de Vagas Órfãs/Stale:** Script periódico para marcar como CLOSED vagas ACTIVE não atualizadas há X dias. *(Completed - 2025-04-17)*
*   [x] **Performance:** Adicionar cache para resultados de busca de vagas frequentes. (API Cache Implemented and Tested)
*   [x] **Filtering:** Refinar palavras-chave e lógica em `greenhouse-filter-config.json` e `GreenhouseFetcher` para maior precisão (LATAM/Remote). (Completed - 2025-04-15)
*   [x] **BugFix:** Investigar e corrigir erros 404 e outros durante `npm run fetch-jobs`. (Completed - 2025-04-15)

## Future Ideas / Full Backlog (Phase 2 & Beyond)

### User Experience & Feedback
*   [ ] Feature: Custom Job Alerts System (Filters, Notifications).
*   [ ] Feature: Job Application History (Extend ClickTracking with user view).
*   [ ] Feature: User Onboarding Flow.
*   [ ] Feature: Social Sharing for job listings.
*   [ ] Feature: Implement "Jobs You Might Like" recommendation section.
*   [ ] UX: Implement Dark Mode Support.
*   [ ] UX: Enhance mobile responsiveness thoroughly.
*   [ ] UX: Implementar estatísticas de cliques para usuários (histórico de vagas visitadas).
*   [ ] **UX/Feedback:** Implement a simple "Report Job" button on job detail pages for users to flag incorrect, expired, or non-remote jobs. (Helps with data quality).
*   [ ] **UX:** Improve accessibility (a11y) compliance based on WCAG guidelines. (Important for broader reach and usability).

### Data Quality & Enrichment
*   [ ] **Data Quality:** Define and implement stricter validation rules for incoming job data during processing (e.g., mandatory fields, date formats).
*   [ ] **Data Enrichment:** Explore adding estimated salary ranges based on title/location/experience if not provided by the source (clearly mark as estimate).
*   [ ] **Integrations/Deduplication:** Implementar Lógica Básica de Desduplicação de Vagas.
*   [ ] **Integrations/Deduplication:** Refine Deduplication Logic (Consider semantic similarity beyond exact title/company match).

### Admin & Monitoring
*   [ ] **Admin/Monitoring:** Criar Painel de Saúde das Fontes (`JobSource Health Dashboard`).
*   [ ] **Admin/Monitoring:** Add performance metrics to the JobSource Health Dashboard (e.g., avg. fetch time, success rate, number of jobs processed/rejected per source).
*   [ ] **Admin:** Create basic admin interface/scripts for manually managing JobSource entries (enable/disable, edit config).
*   [ ] Admin: Create Performance Metrics Dashboard.

### Technical & Infrastructure
*   [ ] Tech: Implement Progressive Web App (PWA) configuration.
*   [ ] Tech: Implement Automated Job Quality Scoring.
*   [ ] Tech: Add Integration Tests.
*   [ ] Tech: Add End-to-End Tests (Playwright/Cypress).
*   [ ] Tech: Optimize database queries & add indexes.
*   [ ] Tech: Implement data analytics tracking for user behavior.
*   [ ] **Tech:** Set up automated dependency vulnerability scanning (e.g., npm audit, Snyk, Dependabot).
*   [ ] **Tech:** Review and document environment variable configuration and secrets management strategy.
*   [ ] **Tech:** Implement structured logging across the application (fetchers, API) for easier debugging and analysis.
*   [ ] **Tech Debt:** Implement proper error handling for API routes
*   [ ] **Performance:** Investigar/Implementar Fetch Incremental (se suportado pelas APIs).
*   [ ] **Security:** Add rate limiting for authentication endpoints
*   [ ] **Security:** Implement CSRF protection for sensitive operations
*   [ ] **Security:** Implement rate limiting for job search API endpoints
*   [ ] **i18n:** Prepare codebase for proper internationalization (currently has i18n config but might need structure)

### Features & Content
*   [ ] Feature: Enhance Recruiter/Company Analytics Dashboard.
*   [ ] Feature: Enhance job filtering (Skills/Technology).
*   [ ] Feature: Implement Saved Searches for Candidates.
*   [x] ~~Feature: Job Detail Page - Add interactive elements (e.g., save job).~~
*   [x] Feature: Job Detail Page - Melhorar UX para redirecionamento ao site de origem da vaga. (Verified Already Implemented)
*   [ ] Feature: Company Profile Pages.
*   [ ] Feature: Curated Job Recommendations system.
*   [ ] Content: Develop Blog section.
*   [ ] Content: Add resources/guides for remote work from Brazil.

### Revenue & Growth
*   [ ] Revenue: Explore Premium Candidate Features (Subscription).
*   [ ] Revenue: Implement Featured Company Profiles.
*   [ ] Revenue: Implement paid job posting plans.
*   [ ] Revenue: Implement featured job listings.
*   [ ] Revenue: Develop partnership features (schools/bootcamps).
*   [ ] Growth: Implement Affiliate Partnership System.
*   [ ] Growth: Implement SEO optimizations.
*   [ ] Growth: Create Referral System.

### Mobile
*   [ ] Mobile: Consider mobile app development.

### Filters
*   [x] **Filters:** Add Salary Range filter.
*   [x] **Filters:** Add Company filter. (Completed)
*   [ ] **Filters:** Add Geographic restrictions filter (e.g., states in Brazil).
*   [ ] **Filters:** Add Language requirements filter.
*   [ ] **Filters:** Implement text search for job listings with result highlighting.
*   [ ] **Filters:** Implement infinite scroll/lazy loading for job list pagination.
*   [ ] **Filters:** Show popular filter tags based on usage.
*   [x] **Filtering:** Análise Contextual de Localização Avançada (ex: "Remote (US Only)").

### Integrations
*   [ ] **Integrations:** Add more job board integrations (LinkedIn API, Indeed API, etc.).
*   [ ] **Integrations:** Implement job scraping framework for other aggregators (requires careful legal review).
*   [ ] **Integrations:** Implement standard API for companies to post jobs directly.
*   [x] **Integrations:** Refactor `fetchGreenhouseJobs.ts` filtering logic (move hardcoded `DEFAULT_FILTER_CONFIG` to DB/config file). (Done - uses external config file now)
*   [x] **Integrations:** Improve reliability/error handling of job fetching scripts. (Completed - 2025-04-15)
*   [x] **Integrations:** Improve content section extraction logic in `fetchGreenhouseJobs.ts`. (Completed - 2025-04-15)
*   [ ] **Integrations/Error Handling:** Rastreamento Detalhado de Erros por Fonte (Contagem, Tipos).
*   [ ] **Integrations/Error Handling:** Desativação Automática Temporária de Fontes com Falha.

### Testing
*   [ ] **Testing Gap:** Create E2E test setup for critical user flows (job search, job click tracking)
*   [x] **Testing Gap:** Add Unit Tests for `GreenhouseFetcher.ts` filtering logic *(Completed - 2025-04-16)*
*   [x] **Testing Gap:** Add Unit Tests for `AshbyProcessor.ts` mapping logic (after implementation) *(Completed - 2025-04-16)*
*   [x] **Testing Gap:** Add Unit Tests for `GreenhouseFetcher.processSource` (including `_fetchJobs` and logger usage). *(Completed - 2025-04-17)*
*   [x] **Testing Gap:** Revisar e Testar `jobUtils` (`detectExperienceLevel`, `detectJobType`, `extractSkills`). *(Completed - 2025-04-17)*

### Legal & Compliance
*   [ ] **Legal:** Draft/Review Privacy Policy and Terms of Service.
*   [ ] **Legal:** Implement Cookie Consent banner/mechanism if targeting users in regions with regulations like GDPR/LGPD.

### Completed / Deprecated Backlog Items
*   [x] **Tech Debt:** Refactor large pages (profile.tsx has 735 lines) into smaller components (Completed)
*   [x] **Optimization:** Add caching layer for frequently accessed job listings (Completed - API Cache)
*   [x] **Performance:** Paralelizar Execução de Múltiplas Fontes no `fetch-jobs`. (Completed - Made concurrency configurable via `FETCH_CONCURRENCY`, default 5) - 2025-04-21
*   [x] **Documentation:** Documentar Lógica de Filtro (Greenhouse & Ashby). (Completed - Created docs/filtering-logic.md) - 2025-04-21
*   [x] **Documentation:** Create API documentation for endpoints (Moved to general Documentation)
*   [x] **Bug Fix:** Improve error handling in job detail page (`src/pages/jobs/[id].tsx`) for missing fields and invalid dates. (Completed)
*   [x] **Bug Fix:** Fix company logos not displaying correctly on job cards. (Completed 2025-04-12)
*   ~~[ ] **Database Maintenance:** Implement automated cleanup of jobs from removed sources~~ *(Substituído por Detecção de Vagas Órfãs/Stale e script manual já criado)*
     *   ~~[ ] Integrate `cleanupRemovedSourceJobs.ts` as a scheduled task to run monthly~~
     *   ~~[ ] Add logging for cleanup operations~~
     *   ~~[ ] Consider implementing soft delete for job sources instead of hard delete to prevent orphaned jobs~~

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
*   **2025-04-16:** Debugged Ashby integration (API URL, Processor logic) and refactored `AshbyProcessor` to use external location config.
*   **2025-04-16:** Created Unit Tests for `AshbyProcessor._mapToStandardizedJob`.
*   **2025-04-16:** Created Unit Tests for `GreenhouseFetcher` filtering logic (`_isJobRelevant` and helpers).
*   **2025-04-16:** Refactored `stripHtml` and `parseDate` into `textUtils.ts` and applied to Ashby/Greenhouse processors.
*   **2025-04-16:** Fixed tests in `AshbyProcessor.test.ts` (removed `_isJobRelevant` tests, corrected location/URL assertions).
*   **2025-04-17:** Added Unit Tests for `GreenhouseFetcher.processSource` including error handling and logger usage.
*   **2025-04-17:** Reviewed and enhanced tests for `jobUtils` (`detectExperienceLevel`, `detectJobType`, `extractSkills`).
*   **2025-04-17:** Created `deactivateStaleJobs.ts` script to detect and close stale job listings, with dry-run mode and configurable days threshold.
*   **2025-04-18:** Fixed regex syntax errors in `AshbyFetcher.test.ts` to enable proper test execution; test failures still exist and need to be addressed.