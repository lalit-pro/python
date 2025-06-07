# YourAI Copilot

**YourAI Copilot** is an AI-powered Chrome/Edge extension designed to enhance your browsing experience. It assists with various web tasks such as summarizing content, answering questions about the page, generating flashcards, extracting keywords, translating text, and monitoring web pages for changes. It's like having a knowledgeable assistant integrated directly into your browser.

This project aims to provide a feature-rich, user-friendly AI companion, similar in spirit to tools like HARPA AI, but built as an open scaffold that can be customized and extended.

## Features

*   **Page Summarization**: Get concise summaries of long articles or web pages in different formats (paragraph, bullet points).
*   **Contextual Q&A**: Ask questions about the current web page or selected text.
*   **Flashcard Generation**: Create Anki-compatible flashcards from text content for study.
*   **Keyword Extraction**: Identify key terms and concepts from a page, with an option for mind-map formatted JSON.
*   **Text Translation**: Translate selected text or entire pages (via LLM).
*   **Custom Prompts**: Define and use your own prompt templates with placeholders for dynamic content (`{{page}}`, `{{selection}}`, etc.).
*   **Page Monitors**: Set up monitors to track changes in specific parts of a web page (e.g., price, stock status, content updates) and receive notifications.
*   **Interactive Sidebar**: A persistent interface for chat, viewing history, and managing prompts.
*   **LLM Support**: Designed to work with multiple LLM providers (OpenAI, Anthropic, Gemini - requires API keys).
*   **Local Data Storage**: Securely stores API keys and preferences locally. History is stored in IndexedDB.

## Setup

Follow these steps to get YourAI Copilot running locally for development or personal use.

### Prerequisites

*   **Node.js**: Version `~12.22.12` (This specific version is targeted for compatibility with older development environments like Windows 7).
*   **npm**: Version `~6.14.16` (Typically comes with Node.js v12.22.12).
    *   You can use a Node Version Manager (like [nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows)) to install and manage specific Node.js versions if your system currently has a different version.
*   A modern web browser that supports Web Extensions (e.g., Google Chrome, Microsoft Edge).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/your-ai-copilot.git # Replace with the actual repo URL
    cd your-ai-copilot
    ```

2.  **Install dependencies:**
    (Ensure your Node.js and npm versions match the prerequisites above before running this.)
    ```bash
    npm install
    ```
    This will install the project's development dependencies, which have been chosen for compatibility with Node.js v12.

3.  **API Keys:**
    This extension requires API keys for the Large Language Models (LLMs) it uses.
    *   Load the unpacked extension into your browser (see "Loading the Unpacked Extension" below).
    *   Open the extension's **Options page**. You can usually access this by right-clicking the extension icon in your browser toolbar and selecting "Options," or by managing extensions in your browser settings.
    *   Navigate to the "API Keys" tab.
    *   Enter your API keys for OpenAI, Anthropic, and/or Google Gemini.
    *   Select your preferred default LLM provider.
    *   Click "Save API Keys." Your keys are stored locally using `chrome.storage.local`.

## Building the Extension (for development)

The project uses CommonJS for its Node.js-executed scripts (like tests). The browser-facing code (content scripts, UI scripts) is written as standard JavaScript.
Currently, this project does not have a complex transpilation or bundling step for the *extension source code itself* (e.g., using Webpack or Rollup). The `npm run build` script primarily copies necessary files to a `dist/` directory for packaging.

If a more complex build process were added (e.g., for UI frameworks, SASS/LESS compilation), the `npm run build` command would handle that.

To prepare files for loading or packaging:
```bash
npm run build
```
This command will ensure all necessary files are copied to the `dist/` folder.

## Loading the Unpacked Extension

### Google Chrome

1.  Open Chrome and navigate to `chrome://extensions`.
2.  Enable "Developer mode" using the toggle switch in the top-right corner.
3.  Click the "Load unpacked" button.
4.  Select the `dist` directory within your `your-ai-copilot` project folder (created by `npm run build`).
5.  The YourAI Copilot extension icon should appear in your browser toolbar.

### Microsoft Edge

1.  Open Edge and navigate to `edge://extensions`.
2.  Enable "Developer mode" using the toggle switch in the bottom-left corner.
3.  Click the "Load unpacked" button.
4.  Select the `dist` directory.
5.  The YourAI Copilot extension icon should appear in your browser toolbar.

## Usage Walkthrough

1.  **Toolbar Icon & Popup**:
    *   Click the YourAI Copilot icon in your browser's toolbar to open the main **popup**.
    *   From the popup, you can:
        *   Quickly perform actions like "Summarize Page," "Generate Flashcards," etc.
        *   Adjust quick settings like language or summary mode.
        *   Open the **Options page** (via the settings/gear icon).
        *   Open the **Sidebar**.

2.  **Sidebar**:
    *   The sidebar provides a more persistent interface for interacting with the AI.
    *   **Chat Tab**: Ask questions about the current page, selected text, or have a general conversation. Use quick action buttons for common tasks.
    *   **History Tab**: View a log of your past interactions (summaries, Q&A, etc.). You can view details, delete items, or export your history.
    *   **Prompts Tab**: Access a library of predefined prompts or create and run your own custom prompt templates using placeholders like `{{page}}`, `{{selection}}`, etc.

3.  **Options Page**:
    *   Manage your API keys.
    *   Enable or disable specific features.
    *   View host permissions granted to the extension.
    *   Manage your stored data (export or clear).

4.  **Context Menus**:
    *   Right-click on selected text on a webpage to quickly access actions like "Summarize selected text" or "Ask YourAI about selected text."

## Development

The project's development tooling has been configured for compatibility with Node.js v12.22.12.

### Module System
*   Node.js-executed scripts (e.g., unit tests, utility scripts run via Node) use the **CommonJS** module system (`require`/`module.exports`).
*   Browser-executed extension scripts (`js/*` directories, `offscreen.js`) use standard browser script loading or ES module syntax if supported directly by the browser version targeted by the extension.

### Linting and Formatting

ESLint (v7.x) and Prettier (v2.x) are used for code quality and consistency.

*   Check for linting errors:
    ```bash
    npm run lint
    ```
*   Check formatting:
    ```bash
    npm run format:check
    ```
*   Fix formatting issues (Prettier):
    ```bash
    npm run format:fix
    ```
*   Fix some linting issues (ESLint):
    ```bash
    npm run lint:fix
    ```

### Testing

*   **Unit Tests (Jest v26.x)**:
    ```bash
    npm test
    ```
    This will run Jest tests located in `tests/unit/`. Jest is configured to use Babel (`babel-jest`) to transpile JavaScript, ensuring compatibility with Node.js v12 for test execution.

*   **End-to-End Tests (Playwright v1.17.x)**:
    ```bash
    npm run test:e2e
    ```
    This runs Playwright tests from `tests/e2e/`.
    **Note on E2E Testing**: Due to the requirement of Node.js v12 compatibility, a significantly older version of Playwright (v1.17.x) is used. This version bundles very old browser binaries (from late 2021). Consequently, E2E tests against modern websites (like YouTube) or complex Manifest V3 extension features may be unreliable or not fully representative. The E2E test suite is maintained for structural purposes and basic UI checks where feasible.

*   **Accessibility Audits (Lighthouse v8.x via Puppeteer v10.x)**:
    ```bash
    npm run audit:accessibility
    ```
    This script (in `tests/accessibility/audit.js`) runs Lighthouse audits on the extension's HTML components. These versions are compatible with Node.js v12 and provide valuable baseline accessibility feedback.

## Roadmap (v1.1+)

This is a foundational scaffold. Future enhancements could include:

*   **Internationalization (i18n)**: Support for multiple languages in the UI.
*   **Additional LLM Providers**: Integration with more LLM services.
*   **Advanced Page Monitoring**: More sophisticated change detection, webhook customization.
*   **Streaming LLM Responses**: For a more interactive chat experience.
*   **UI/UX Polish**: Enhancements to the visual design and user experience.
*   **More Robust Error Handling**: Granular error reporting and recovery.
*   **Modernization of Dev Stack**: If Node.js version constraints are lifted, upgrade development dependencies for improved features, security, and performance.
*   **Detailed Documentation**: In-depth documentation for developers and users.

## Contributing

Contributions are welcome! If you'd like to contribute, please:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes.
4.  Ensure your code lints and tests pass in a Node.js v12.22.12 environment.
5.  Commit your changes.
6.  Push to the branch.
7.  Create a new Pull Request.

Please ensure your PR provides a clear description of the changes and why they are needed.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details (assuming a LICENSE file will be added).

---

*This README provides a general guide. Specific commands and paths may need adjustment based on the final project structure and `package.json` scripts.*
