# TASK LIST - RemoteJobsBR

<!-- 
Purpose: Tracks current tasks, backlog, and sub-tasks. 
AI Prompt: "Update TASK.md to mark XYZ as done and add ABC as a new task."
LLM should update this file based on conversational progress.
-->

## Current Focus / Active Tasks (What I'm working on NOW)

*   [x] Setup initial Next.js project structure with TypeScript, Tailwind CSS.
*   [x] Configure Prisma and connect to PostgreSQL database (local setup).
*   [x] Define initial Prisma schema based on `PLANNING.md`.
*   [x] **Architecture:** Reestruturar o modelo de dados para funcionar como agregador de links externos (**Schema atualizado, código inicial refatorado**).
*   [~] **Testing:** Setup basic Unit Testing Framework (e.g., Jest/Vitest) (**Installed, configured, basic tests exist**)
*   [x] **Testing:** Create first component tests for jobs listing page. (**tests/components/jobs/WideJobCard.test.tsx created**)
*   [x] **Testing:** Write basic API route tests for job fetching. (**tests/api/jobs/search.test.ts created**)
*   [x] **Testing:** Expand test coverage to include unit tests for utility functions. (Added tests for email, jobUtils, jobProcessingService, JobProcessingAdapter, greenhouseProcessor)
*   [x] **Testing:** Add mock configuration for NextAuth sessions and protected routes.

## Next Up (Prioritized Backlog - Phase 1: Core UX & Stability)

*   [x] **Auth:** Implement NextAuth.js setup (Email Magic Link, Google, LinkedIn Providers).
*   [x] **Auth:** Create basic registration/login UI flow for Candidates & Recruiters.
*   [x] **DB:** Create initial database migration based on schema (`prisma migrate dev`).
*   [x] **Code Refactor:** Adaptar código (API Routes, UI, fetch scripts) para o novo schema sem Application/InterviewEvent.
*   [x] **Jobs:** Implement basic job listing page (fetching placeholder/manual data).
*   [x] **Jobs:** Implement Job Posting API endpoint (Recruiter role required).
*   [x] **Jobs:** Implement basic Job Posting Form UI (for Recruiters).
*   [x] **Integration:** Setup Greenhouse job fetching logic (basic script/API route).
*   [x] **Jobs:** Refine Job Listing Page UI (implement loading skeletons, error state display).
*   [x] **Jobs:** Implement server-side pagination for job listings API (`/api/jobs`).
*   [x] **Jobs:** Improve Job Detail Page with external redirection UX indicators.
*   [ ] **User Features:** Implementar sistema de vagas salvas (favoritos) para usuários. (**Button added, Page created, Tests added**)
*   [x] **User Features:** Implement click tracking system for external job links (**API & Hook created, used in JobDetail, Tests added**)
*   [x] **Recruiter Dashboard:** Implement API route to fetch jobs posted by a recruiter.
*   [x] **Recruiter Dashboard:** Reconstruir para focar em métricas de cliques e visualizações de vagas (**API & Frontend Updated**).
*   [ ] **Testing:** Write initial unit tests for Auth logic.
*   [ ] **Testing:** Write more component tests for major UI elements (filters, pagination).
*   [x] **Testing:** Add unit tests for `useTrackJobClick` hook.
*   [x] **Testing:** Add API tests for `/api/jobs/[jobId]/track-click` endpoint.
*   [ ] **Monitoring:** Setup basic Error Monitoring (e.g., Sentry integration or Vercel monitoring).
*   [x] **Notifications:** Setup email service (e.g., Resend) integration.
*   [ ] **Filters:** Implement URL query parameter state management for filters.
*   [ ] **Filters:** Add "Technology/Stack" filter option (Schema, API, UI).
*   [ ] **Filters:** Enhance Filter UI/UX (Collapsible mobile, Chips, Clear All, Result Count).
*   [ ] **Filters:** Implement debounce for filter inputs.

## Future Ideas / Full Backlog (Phase 2 & Beyond)

*   [ ] Feature: Enhance job filtering (Skills/Technology).
*   [ ] Feature: Implement Saved Searches for Candidates.
*   [x] ~~Feature: Job Detail Page - Add interactive elements (e.g., save job).~~
*   [ ] Feature: Job Detail Page - Melhorar UX para redirecionamento ao site de origem da vaga.
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
*   [x] **Schema:** Adicionar campos para URLs de vagas externas e tracking de cliques
*   [x] ~~**UX:** Melhorar UI para claramente indicar redirecionamento a sites externos para aplicação~~
*   [x] ~~**UX:** Improve external link indicators to clearly show users they'll be redirected~~
*   [ ] **Testing Gap:** Need to setup Jest and React Testing Library configurations
*   [ ] **Testing Gap:** Create E2E test setup for critical user flows (job search, job click tracking)
*   [ ] **Testing Gap:** Add API endpoint tests for authentication routes
*   [ ] **Testing Gap:** Add Unit Tests for `fetchGreenhouseJobs.ts` filtering logic
*   [ ] **Testing Gap:** Add Integration Tests for job fetching scripts (mocking APIs and DB)
*   [x] **Testing:** Add unit tests for `useTrackJobClick` hook.
*   [x] **Testing:** Add API tests for `/api/jobs/[jobId]/track-click` endpoint.
*   [ ] **Tech Debt:** Implement proper error handling for API routes
*   [ ] **Tech Debt:** Refactor large pages (profile.tsx has 735 lines) into smaller components
*   [ ] **Optimization:** Add caching layer for frequently accessed job listings
*   [ ] **Optimization:** Implement server-side pagination for job listings
*   [ ] **Security:** Add rate limiting for authentication endpoints
*   [ ] **Security:** Implement CSRF protection for sensitive operations
*   [ ] **Security:** Implement rate limiting for job search API endpoints
*   [ ] **Documentation:** Create API documentation for endpoints
*   [ ] **i18n:** Prepare codebase for proper internationalization (currently has i18n config but might need structure)
*   [ ] **Analytics:** Implementar sistema de rastreamento de cliques em vagas externas
*   [x] **Refactor:** Refactor jobs listing page (`src/pages/jobs/index.tsx`) to use client-side fetching (e.g., SWR/React Query) for filters and pagination to enable better loading states (skeletons). (**SWR implemented, loading state improved, pagination added, tests added**)
*   [ ] **Bug Fix:** Improve error handling in job detail page (`src/pages/jobs/[id].tsx`) for missing fields and invalid dates.
*   [x] **Jobs:** Implement sorting functionality for job listings page.
*   [x] **Refactor:** Migrate job listing functionality from `/jobs` page to home page (`/`).

## Bug Fixes

*   [x] **React Error:** Fix "Objects are not valid as a React child (found: object with keys {name, logo})" error occurring on page load (likely home page). (Reported: {Current Date})

## Milestones

*   [x] **Milestone: MVP Setup Complete** (Initial Project, DB, Auth Setup)
*   [ ] ~~**Milestone: Core Job Board Functional** (Posting, Listing, Applying, Greenhouse Sync)~~
*   [ ] **Milestone: Core Job Board Functional** (Posting, Listing, External Links, Greenhouse Sync)
*   [ ] ~~**Milestone: Basic Dashboards & Notifications Live** (Candidate/Recruiter Dashboards, Core Emails)~~
*   [ ] **Milestone: Dashboards & Click Tracking** (User Favorites, Recruiter Analytics)
*   [ ] **Milestone: Core MVP Launch Ready** (Phase 1 items complete, tested, deployed)
*   [ ] **Milestone: Enhanced Search & Growth Foundation** (Phase 2 items like skills filter, SEO basics)

## Recently Completed

*   **{Current Date}:** Initialize `PLANNING.md` and `TASK.md`. _(Moved from previous structure)_
*   **{Current Date}:** Ajuste arquitetural - redefinir o sistema como agregador de links (estilo Remotive/Remote OK) em vez de aplicações diretas.
*   **{Current Date}:** Atualizar schema Prisma e migrar banco de dados para remover modelos `Application` e `InterviewEvent` e adicionar campo `clickCount`.
*   **{Current Date}:** Refatorar código inicial (tipos, UI) para remover referências a `Application` e campos relacionados.
*   **{Current Date}:** Instalar e configurar Jest para testes unitários.
*   **{Current Date}:** Adicionar mock para `next-auth/react` em `jest.setup.js`.
*   **{Current Date}:** Expandir testes unitários para `src/lib` (email, services, utils, adapters, jobProcessors).
*   **{Current Date}:** Implement sorting functionality for job listings page.
*   **{Current Date}:** Improve Job Detail Page with external redirection UX indicators.
*   **{Current Date}:** Add Save Job button to Job Detail Page and create Saved Jobs page structure. 
*   **{Current Date}:** Add tests for SaveJobButton, saved-jobs page, and saved jobs API endpoints. 
*   **2025-04-10:** Added `/api/jobs/search` tests.
*   **2025-04-11:** Add tests for SaveJobButton, saved-jobs page, and saved jobs API endpoints.
    *   `SaveJobButton.test.tsx`: ✅ DONE
    *   `saved-jobs.test.tsx`: ✅ DONE
    *   `api/jobs/saved/[jobId].test.ts`: 🚧 BLOCKED (Jest/SWC ESM config issues)
    *   `api/users/me/saved-jobs.test.ts`: 🚧 BLOCKED (Jest/SWC ESM config issues)
    *   `useJobsSearch.test.tsx`: 🚧 BLOCKED (Jest/SWC JSX parsing issue)

### 📈 Analytics & Tracking
// ... rest of the file 