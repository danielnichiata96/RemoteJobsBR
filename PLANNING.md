# Project Planning: RemoteJobsBR

## 1. Project Purpose & Vision

*   **Core Goal:** Create a website aggregating international remote job opportunities specifically curated for Brazilian applicants.
*   **Target Audience:** Brazilian professionals seeking 100% remote work with international companies.
*   **Job Board Model:** Functioning as a job listing aggregator (similar to Remotive, Remote OK) that redirects users to external application pages rather than handling applications directly.

## 2. Architecture & Structure

*   **Framework:** Next.js (React framework)
*   **Backend:** Handled via Next.js API Routes.
*   **Database:** PostgreSQL
*   **ORM:** Prisma
*   **Styling:** Tailwind CSS
*   **Authentication:** NextAuth.js
*   **File Structure:**
    ```
    remotejobsbr/
    ├── src/
    │   ├── components/      # Reusable React components
    │   ├── pages/           # Next.js pages and API routes
    │   ├── lib/             # Utility functions, configurations, Prisma client
    │   ├── styles/          # Global CSS, Tailwind config
    │   ├── hooks/           # Custom React hooks
    │   └── types/           # TypeScript type definitions
    ├── prisma/              # Database schema, migrations, seeds
    ├── public/              # Static assets (images, fonts)
    ├── tests/               # Unit and integration tests (mirroring src/)
    ├── scripts/             # Standalone scripts (e.g., data fetching, DB maintenance)
    └── node_modules/        # Project dependencies
    └── .next/               # Next.js build output
    └── ...                  # Config files (.env, next.config.js, tsconfig.json, etc.)
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
*   **Other Libraries:** `axios`, `date-fns`, `react-hook-form`, `zod`, `swr`, `bcryptjs`, `@sendgrid/mail` / `nodemailer` (for email)

## 4. Development Guidelines & Constraints

*   **Node.js Version:** >= 18.0.0
*   **Code Style:** Follow standard TypeScript/React best practices, adhere to ESLint rules. Maintain consistency with existing code.
*   **Modularity:** Keep files focused and under 500 lines. Refactor large components/modules into smaller, reusable pieces.
*   **Imports:** Prefer relative imports within the `src` directory.
*   **Testing:**
    *   Create unit tests for all new features (functions, components, API routes).
    *   Place tests in the `/tests` directory, mirroring the `src` structure.
    *   Include tests for expected use, edge cases, and failure scenarios.
    *   Update existing tests when related logic changes.
*   **Documentation:** Update `README.md` for significant changes (setup, features, dependencies). Keep `PLANNING.md` and `TASK.md` up-to-date.
*   **Environment:** Requires a PostgreSQL database and properly configured `.env` file (based on `.env.example`).

## 5. Key Data Models

*   **User:** Supports multiple roles (Candidate, Recruiter/Company) with role-specific fields
*   **Job:** Contains job details, required skills, location info, and external application URLs
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

## 7. AI Assistant Collaboration Rules

*   **Reference `PLANNING.md`:** Consult this document at the start of new conversations for project context.
*   **Manage `TASK.md`:** Update task status and add newly discovered tasks to `TASK.md`.
*   **Adhere to Guidelines:** Follow all rules defined in section 4.
*   **Ask When Unsure:** Do not assume context or make guesses about file paths, library usage, or requirements.
*   **Verify:** Confirm file/module existence before referencing.
*   **No Overwriting:** Do not delete or overwrite code unless instructed or as part of an agreed-upon task. 