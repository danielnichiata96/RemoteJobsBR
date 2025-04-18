# Project Planning: RemoteJobsBR

## Quick Reference: Core Tech
- **Framework:** Next.js (React)
- **Language:** TypeScript
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Styling:** Tailwind CSS
- **Authentication:** NextAuth.js

## 1. Project Purpose & Vision

*   **Core Goal:** Create a website aggregating international remote job opportunities specifically curated for Brazilian applicants. Only 100% Remote jobs.
*   **Target Audience:** Brazilian professionals seeking 100% remote work with international companies.
*   **Job Board Model:** Functioning as a job listing aggregator (similar to Remotive, Remote OK) that redirects users to external application pages rather than handling applications directly.

## 2. Architecture & Structure

*   **Framework:** Next.js (React framework)
*   **Backend:** Handled via Next.js API Routes.
*   **Database:** PostgreSQL
*   **ORM:** Prisma
*   **Styling:** Tailwind CSS
*   **Authentication:** NextAuth.js
### 2.1 File Structure
    ```
    remotejobsbr/
    ├── src/
    │   ├── components/      # Reusable React components
    │   ├── pages/           # Next.js pages and API routes
    │   ├── lib/
    │   │   ├── adapters/        # Adapters (e.g., JobProcessingAdapter)
    │   │   ├── fetchers/        # Job fetcher implementations (e.g., Greenhouse, Lever, Ashby)
    │   │   ├── jobProcessors/   # Job processor implementations (e.g., Greenhouse, Lever, Ashby)
    │   │   ├── services/        # Service layer (e.g., JobProcessingService) 
    │   │   ├── utils/           # Shared utility functions (job, date, text, logo)
    │   │   └── prisma.ts        # Prisma client instance
    │   ├── styles/          # Global CSS, Tailwind config
    │   ├── hooks/           # Custom React hooks
    │   └── types/           # TypeScript type definitions
    ├── prisma/              # Database schema, migrations, seeds
    ├── public/              # Static assets (images, fonts)
    ├── tests/               # Unit and integration tests (mirroring src/)
    ├── scripts/             # Standalone scripts (e.g., data fetching, DB maintenance)
    ├── config/              # Configuration files (e.g., filter configs)
    └── node_modules/        # Project dependencies
    └── .next/               # Next.js build output
    └── ...                  # Root config files (.env, next.config.js, tsconfig.json, etc.)
    ```

## 3. Tech Stack & Tools

*   **Languages:** TypeScript
*   **Frontend:** Next.js, React
*   **Backend:** Next.js API Routes
*   **Database:** PostgreSQL, Prisma
*   **Styling:** Tailwind CSS
*   **Authentication:** NextAuth.js
*   **Package Manager:** npm (or yarn)
*   **Linting:** ESLint (configured for Next.js)
*   **Deployment:** Vercel
*   **Other Libraries:** 
    *   `axios` (HTTP requests)
    *   `p-map` (Parallel async operations)
    *   `pino` (Logging)
    *   `sanitize-html`, `html-entities` (HTML cleaning/processing)
    *   `date-fns` (Date utilities - *Consider replacing with built-in Date or dedicated lightweight lib if only basic parsing is needed*)
    *   `react-hook-form`, `zod` (Form handling/validation)
    *   `swr` (Client-side data fetching/caching)
    *   `bcryptjs` (Password hashing)
    *   `@sendgrid/mail` / `nodemailer` (Email sending)
    *   `cheerio` (*Review if still actively used for scraping/HTML parsing*)
    *   `node-cache` (Server-side API caching)

## 4. Development Guidelines & Constraints

*   **Node.js Version:** >= 18.0.0
*   **Code Style:** Follow standard TypeScript/React best practices, adhere to ESLint rules. Maintain consistency with existing code.
*   **Modularity:** Keep files focused and under 500 lines. Refactor large components/modules into smaller, reusable pieces.
*   **Imports:** Prefer relative imports within the `src` directory.
### 4.1 Testing Guidelines
    *   Create unit tests for all new features (functions, components, API routes).
    *   Place tests in the `/tests` directory, mirroring the `src` structure.
    *   Include tests for expected use, edge cases, and failure scenarios.
    *   Update existing tests when related logic changes.
### 4.2 Documentation Guidelines
    *   Update `README.md` for significant changes (setup, features, dependencies). Keep `PLANNING.md` and `TASK.md` up-to-date.
*   **Environment:** Requires a PostgreSQL database and properly configured `.env` file (based on `.env.example`).

### 4.3 Maintenance & Utility Scripts
    *   `npm run fetch-jobs`: Executes `src/scripts/fetchJobSources.ts` to fetch new jobs from all enabled sources. Concurrency is configurable via `FETCH_CONCURRENCY` env var.
    *   `npm run deactivate-stale-jobs`: Executes `scripts/deactivateStaleJobs.ts` to mark old job postings as inactive (CLOSED).
    *   `npm run add-bulk-sources`: Executes `src/scripts/addBulkJobSources.ts` to add/update multiple Greenhouse sources defined in the script.
    *   `npm run list-sources`: Executes `src/scripts/listJobSources.ts` to display currently configured job sources in the database.
    *   `npm run clean-db`: Executes `src/scripts/cleanDatabase.ts`. *Purpose: General database cleanup (specific actions TBC).*
    *   `npm run fix-jobs`: Executes `src/scripts/fixJobSources.ts`. *Purpose: Fixes potential issues with job sources (specific actions TBC).*
    *   `npm run prisma:studio`: Opens Prisma Studio for direct database inspection/modification.

## 5. Key Data Models

*   **User:** Supports multiple roles (Candidate, Recruiter/Company) with role-specific fields
*   **Job:** Contains job details, required skills, location info, and external application URLs
*   **JobSource:** Defines a source of job listings (e.g., Greenhouse board), including URL, type, and configuration.
*   **SavedJob:** Tracks jobs saved/favorited by candidates
*   **ClickTracking:** Records when users click on external job links (for analytics)
*   **Newsletter:** Manages user email preferences for job notifications

## 6. Core User Flows

*   **Job Discovery:** Users browse and filter job listings
*   **External Application:** Users click through to apply on original job source websites
*   **Saved Jobs:** Users can save interesting job postings for later reference
*   **Job Alert:** Users receive email notifications for new jobs matching their criteria
*   **Job Posting:** Recruiters/companies can post jobs with external application links
*   **Analytics:** Recruiters can view metrics on job views and click-throughs
*   **Admin Dashboard:** Administrators can monitor source health and perform actions
    *   **Source Toggle:** Enable/disable specific job sources
    *   **Source Re-run:** Manually trigger job processing for specific sources
    *   **Health Monitoring:** View metrics and status for each job source

## 7. Core Services

*   **JobProcessingAdapter:** (Located in `src/lib/adapters/`) Selects the appropriate processor (Greenhouse, Lever, Ashby) based on the job source type and orchestrates the processing and saving via the JobProcessingService.
*   **JobProcessingService:** (Located in `src/lib/services/`) Central service handling job processing workflows.
    *   **saveOrUpdateJob:** Saves or updates standardized job data in the database, including deduplication logic.
    *   **deactivateJobs:** Marks jobs as inactive when no longer available from source (used by `deactivateStaleJobs.ts` script).
    *   **processJobSourceById:** Processes a specific job source by ID (triggered manually via admin).

---

## 8. AI Assistant Collaboration Rules

*   **Reference `PLANNING.md`:** Consult this document at the start of new conversations for project context.
*   **Manage `TASK.md`:** Update task status and add newly discovered tasks to `TASK.md`.
*   **Adhere to Guidelines:** Follow all rules defined in section 4.
*   **Ask When Unsure:** Do not assume context or make guesses about file paths, library usage, or requirements.
*   **Verify:** Confirm file/module existence before referencing.
*   **No Overwriting:** Do not delete or overwrite code unless instructed or as part of an agreed-upon task.

### Performance Optimizations

- Pagination: Server-side pagination is implemented on `/api/jobs/search` endpoint, allowing for efficient browsing of large result sets.
- Client-side caching: Implemented with SWR for client-side data fetching with automatic revalidation.
- Server-side caching: Implemented with `node-cache` for `/api/jobs/search` endpoint, reducing database load for frequently accessed searches.
  - Cache keys are generated based on query parameters (sorting them for consistency).
  - TTL (Time-To-Live) of 1 hour for cache entries.
  - Cache-Control headers are set for browser/CDN caching. 