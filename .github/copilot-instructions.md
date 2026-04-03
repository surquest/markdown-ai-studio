# Copilot Instructions for Lumina Markdown

**Role:** Expert Full-Stack Engineer & Cloud Architect (Specializing in React 19, Google Cloud Vertex AI, and Monaco Editor integration).

## Project Details & Architecture
- **Project Name:** Markdown AI Studio
- **Type:** Client-side-only Markdown Editor optimized for static hosting (SSG) and direct browser-to-Cloud API communication.
- **Architecture Constraints:** NO Node.js/Server components. All logic must reside in the browser.

## Technical Stack
- **Core:** React 19, Next.js 15+ (Output: `export`), TypeScript (Strict).
- **UI:** Material UI (MUI) v7+ (strictly v7, no v6). Use "Light Mode" focused UI.
- **Editor:** `@monaco-editor/react`.
- **Markdown:** `react-markdown`, `remark-gfm`, `rehype-raw`.
- **Diagrams:** `mermaid` (SVG injection) and Draw.io (XML iframe embedding).
- **Auth:** Google Identity Services (`@react-oauth/google`).
- **State Management:** React Context for global config and auth state.
- **Images & Assets:** Allow to upload images and use them in the markdown content. Store images in-memory or use a free image hosting API (e.g., Imgur) for temporary storage.

## Implementation Guidelines

### 1. Centralized Configuration & Auth
- Implmement a `ConfigProvider` via React Context to manage: `clientId`, `projectId`, `location`, `modelId`, `temperature`, and `systemInstruction`.
- **Auth Flow:** Implement a "Landing/Login" gate (`LoginGate.tsx`). Users must authenticate via Google to access the app.
- **Scope:** Use `https://www.googleapis.com/auth/cloud-platform`.
- **Security:** Store the resulting `access_token` strictly in memory (React State), NEVER in `localStorage`. Handle token expiration gracefully by prompting a re-login.

### 2. Vertex AI Integration
- Direct Vertex AI REST API fetching from the browser using standard `fetch`. 
- Handle API errors (401 for expired tokens, 403 for permission issues) gracefully displaying MUI Snackbars.
- Allow AI configuration for model selection and thinking level.
- Configuration UI: A dedicated "Settings" dialog accessible from the main UI to update AI parameters as gemini model selection, thinking level, and system instructions. Changes should reflect immediately in the AI interactions without requiring a page reload.

### 3. Monaco Editor AI Features
- **Rewrite Tool:** Floating MUI `Popper` appears on text selection. Trigger an MUI `Dialog` for user instructions. Use `editor.executeEdits` to replace text to preserve the Undo stack intact.
- **Contextual Completion:** "Generate" button that adds AI generated text directly in the Monaco Editor at the cursor position. The prompt and system instruction are user-defined with context defaults.
- **UI Sync:** Ensure the Monaco Editor and Preview Pane sync their scrolling.

### 4. Preview Engine
- **Mermaid:** Custom `CodeBlock` component for `react-markdown`. If language is `mermaid`, use `mermaid.render` to generate and display an SVG.
- **Draw.io:** If a code block is tagged `drawio`, render an iframe pointing to `embed.diagrams.net` using the XML content.
- **Outline Sidebar:** Recursively parse the Markdown string for `#` headers to build a clickable Table of Contents that uses `window.scrollTo` or `scrollIntoView`.

## Required File Structure Conventions
- `next.config.js`: Configure `output: 'export'` and `distDir`.
- `theme.ts`: MUI theme configuration with a focus on Light Mode.
- `lib/context/ConfigContext.tsx`: Store GCP/AI settings as (Oauth clientId, projectId, location, Gemini models, thinking levels, examples of system instructions).
- `lib/hooks/useVertexAI.ts`: Custom hook to handle REST `fetch` logic, header injection, and error handling.
- `components/auth/LoginGate.tsx`: Wrapper to prevent app access without a valid token.
- `components/editor/MonacoWrapper.tsx`: Handles Monaco mounting and AI `executeEdits`.
- `components/preview/MarkdownPreview.tsx`: The rendering engine with Mermaid/Draw.io logic.
- `app/page.tsx`: The main split-pane layout using `react-resizable-panels` or MUI Grids.
