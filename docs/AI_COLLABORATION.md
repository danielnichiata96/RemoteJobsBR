# AI Collaboration Guidelines for RemoteJobsBR

This document outlines the rules, expectations, and best practices for AI coding assistants (like Cursor, Gemini, Claude, etc.) collaborating on the RemoteJobsBR project. Adhering to these guidelines ensures consistency, maintainability, reliability, and efficient collaboration.

## 📜 **Phase 0: Initial Context & Task Setup**

1.  **Read the Plan:** **Always reference `PLANNING.md`** at the start of *every new conversation or major task*. Understand the project's overall context, architecture, goals, tech stack, style rules, and constraints *before* proceeding.
2.  **Check the Tasks:** **Always consult `TASK.md`** to understand current tasks, backlog priorities, and project status.
3.  **Manage Tasks:**
    *   If starting a task not listed in `TASK.md`, **add it first** with a brief description and the current date (YYYY-MM-DD).
    *   The AI should be instructed to **update `TASK.md` immediately** after completing a task (marking it `[x]`) or when new sub-tasks, bugs, or necessary refactors are identified during development (adding them to the appropriate section).

## ⚙️ **Phase 1: Development & Coding Practices**

### 📐 Architecture & Code Structure
1.  **Follow the Blueprint:** Adhere strictly to the guidelines defined in `PLANNING.md`, including:
    *   **Code Style:** Conform to TypeScript/React best practices and ESLint rules.
    *   **Naming & Structure:** Use consistent naming conventions and file structures.
    *   **Architecture:** Follow established patterns (e.g., Fetcher/Processor/Adapter).
2.  **Modularity & Conciseness:**
    *   **Keep files focused and under 500 lines.** If a file approaches this limit, proactively suggest or perform refactoring by splitting it into smaller, reusable modules, components, or helper functions.
    *   Organize code into clearly separated modules grouped by feature or responsibility.
3.  **Clean Imports:** Use clear, consistent imports. **Prefer relative imports** for modules within the `src` directory (e.g., `../utils/dateUtils` instead of `src/lib/utils/dateUtils`).

### 🖥️ Command Execution
1.  **PowerShell Compatibility:** This project environment primarily uses PowerShell. **Do NOT use `&&` for command chaining.** Use separate commands or PowerShell-compatible syntax (e.g., semicolons `;` if appropriate, or multi-line commands).

### 🧪 Testing & Reliability
1.  **Test Driven:** **Always create unit tests** for new features, functions, classes, components, hooks, API routes, etc.
2.  **Update Tests:** When modifying existing logic, **check if related unit tests need updating.** If so, update them as part of the same task. Refactoring must preserve functionality and tests should reflect that.
3.  **Test Location:** Place tests in the `/tests` directory, mirroring the `src` structure (e.g., tests for `src/lib/utils/jobUtils.ts` go in `tests/lib/utils/jobUtils.test.ts`).
4.  **Test Coverage (Minimum):** For each unit/feature, include *at least*:
    *   One test for the expected, successful use case.
    *   One test for a known edge case.
    *   One test for an expected failure or error condition.

### 🧠 Core AI Behavior Rules (During Coding)
1.  **Ask, Don't Assume:** **Never assume missing context.** If requirements, file paths, module names, library usage, or desired behavior are unclear, **ask clarifying questions** or request additional information (e.g., using tools to read files or list directories if available).
2.  **Verify Existence:** Before referencing a file, module, function, or variable in code or tests, **verify its existence** within the project structure.
3.  **No Hallucinations:** Only use libraries, functions, and patterns that are **already part of the project's tech stack** (see `PLANNING.md`, `package.json`) or standard language features (Node.js/TypeScript). Do not invent or suggest non-existent libraries without discussion.
4.  **Respect Existing Code:** **Never delete or overwrite existing code** unless *explicitly* instructed to do so as part of an agreed-upon task from `TASK.md`. Prioritize modifying or extending existing code where appropriate.
5.  **Use Editing Tools:** Code changes should preferably be proposed using available **editing tools** (e.g., `edit_file` capabilities, applying diffs) rather than just displaying large code blocks in the chat. Diffs should be clear and concise.

## ✅ **Phase 2: Documentation & Finalization**

1.  **Keep Docs Updated:** If changes affect setup, add/modify features, change dependencies, or alter core logic documented elsewhere:
    *   **Update `README.md`** for setup, dependency, or major user-facing feature changes.
    *   **Update relevant files within the `docs/` folder** (e.g., `docs/architecture/`, `docs/api/`, `docs/guides/`, `docs/filtering-logic.md`) if the changes impact those areas.
    *   Ensure `PLANNING.md` remains an accurate high-level overview (detailed changes go in `docs/` or code comments).

## 💬 **Phase 3: Communication & Interaction**

1.  **Clear Instructions:** Provide clear, specific instructions to the AI. Break down complex tasks into smaller, manageable steps.
2.  **Review & Feedback:** Carefully review code proposals, documentation updates, and task management actions performed by the AI. Provide constructive feedback if changes are incorrect, incomplete, or do not follow guidelines.
3.  **Iterate:** Be prepared to iterate. Complex tasks or bug fixes may require several attempts and refinements through conversation with the AI.

---

By following these guidelines, collaboration with AI assistants becomes more productive, reliable, and aligned with the goals and standards of the RemoteJobsBR project. Thank you for your collaboration!