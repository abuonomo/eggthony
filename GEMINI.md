# Gemini CLI Instructions for Eggthony

## Core Mandates
- **Context:** You are working on a Vite-bundled HTML5 Canvas game called Eggthony.
- **State Management:** The game uses a single, massive mutable state object `S` imported from `src/state.js`. Never duplicate state variables; always read and write directly to `S`.
- **Imports:** The codebase uses strict ES6 modules. Ensure all new functions or variables are properly exported and imported without causing circular dependencies.

## Build and Testing Workflow
- **Development Iteration:** Use `npm run dev` to start the local Vite server. The game serves from `localhost:5173`.
- **Pre-Commit Verification (CRITICAL):** Dev servers can mask case-sensitivity and asset-pathing errors that will break the Linux-based GitHub Actions deployment.
- **Before committing or pushing any code to main, you MUST run:**
  `npm run build`
- **Success Criteria:** If the build command fails, you must investigate and fix the Vite bundling error before proceeding. A successful build is required to ensure the live game will compile.
