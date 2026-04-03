# Markdown AI Studio

Markdown AI Studio is a powerful, client-side-only Markdown Editor optimized for static hosting natively integrated with Google Cloud Vertex AI. It provides an advanced environment for writing, editing, and previewing Markdown with the assistance of Gemini models.

## Key Features

* **AI-Powered Editing (Gemini)**: Deep integration with Gemini models for text rewriting, text correction, and contextual code/content generation natively within the Monaco Editor.
* **Advanced Live Preview**: Real-time rendering of Markdown featuring:
  * **Mermaid.js Diagrams**: Native rendering of Mermaid code blocks.
  * **Draw.io Integration**: Live embedding and interactive viewer for Draw.io XML diagrams directly inside the Markdown preview.
  * **MkDocs-Style Snippets**: Seamlessly include code files from the workspace as highlighted code blocks using the `--8<-- "path/to/file"` syntax.
* **Virtual File System (VFS)**: A purely browser-based file manager utilizing IndexedDB. Supports creating files, making folders, and importing media assets (images, diagrams, code scripts) with drag-and-drop, all functioning without a backend.
* **Zero-Backend Architecture**: Built to be exported statically. All AI communication happens securely peer-to-cloud from the browser to Vertex AI via Google Identity Services (`@react-oauth/google`).

## Tech Stack

* **Core**: React 19, Next.js 15+ (Static Export), TypeScript
* **UI**: Material UI (MUI) v7
* **Editor**: `@monaco-editor/react`
* **Markdown Engine**: `react-markdown`, `remark-gfm`, `rehype-raw`
* **Storage**: IndexedDB (Local VFS)
