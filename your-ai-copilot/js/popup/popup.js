// your-ai-copilot/js/popup/popup.js
document.addEventListener('DOMContentLoaded', () => {
    const summarizeBtn = document.getElementById('summarizeBtn');
    const qaBtn = document.getElementById('qaBtn');
    const flashcardsBtn = document.getElementById('flashcardsBtn');
    const keywordsBtn = document.getElementById('keywordsBtn');
    const translateBtn = document.getElementById('translateBtn');
    const languageSelect = document.getElementById('languageSelect');
    const summaryModeSelect = document.getElementById('summaryMode');
    const statusArea = document.getElementById('statusArea');
    const settingsButton = document.getElementById('settingsButton');
    const openSidebarBtn = document.getElementById('openSidebarBtn');

    // --- Utility to update status ---
    function updateStatus(message, isError = false, isSuccess = false) {
        statusArea.innerHTML = ''; // Clear previous messages
        const p = document.createElement('p');
        p.textContent = message;
        if (isError) p.classList.add('error');
        if (isSuccess) p.classList.add('success');
        statusArea.appendChild(p);
    }

    // --- Load stored preferences ---
    chrome.storage.sync.get(['selectedLanguage', 'selectedSummaryMode'], (result) => {
        if (result.selectedLanguage) {
            languageSelect.value = result.selectedLanguage;
        }
        if (result.selectedSummaryMode) {
            summaryModeSelect.value = result.selectedSummaryMode;
        }
    });

    // --- Event Listeners for Preferences ---
    languageSelect.addEventListener('change', (event) => {
        chrome.storage.sync.set({ selectedLanguage: event.target.value });
        updateStatus('Language preference saved.', false, true);
    });

    summaryModeSelect.addEventListener('change', (event) => {
        chrome.storage.sync.set({ selectedSummaryMode: event.target.value });
        updateStatus('Summary mode preference saved.', false, true);
    });

    // --- Event Listeners for Actions ---
    settingsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    openSidebarBtn.addEventListener('click', () => {
        updateStatus('Opening sidebar...');
        // This message will be caught by the background script or a content script
        // to manage sidebar visibility.
        chrome.runtime.sendMessage({ action: 'toggleSidebar', reason: 'popup_button' }, response => {
            if (chrome.runtime.lastError) {
                updateStatus(`Error opening sidebar: ${chrome.runtime.lastError.message}`, true);
            } else if (response && response.success) {
                updateStatus('Sidebar action initiated.', false, true);
                // Optionally close popup: window.close();
            } else {
                updateStatus(`Sidebar action status: ${response ? response.message : 'No response.'}`, !response || !response.success);
            }
        });
    });

    summarizeBtn.addEventListener('click', async () => {
        handlePageAction('summarize');
    });

    qaBtn.addEventListener('click', async () => {
        // Q&A usually involves the sidebar for interaction
        updateStatus('Opening sidebar for Q&A...');
        chrome.runtime.sendMessage({ action: 'toggleSidebar', context: 'qa' }, () => window.close());
    });

    flashcardsBtn.addEventListener('click', async () => {
        handlePageAction('generateFlashcards');
    });

    keywordsBtn.addEventListener('click', async () => {
        handlePageAction('extractKeywords');
    });

    translateBtn.addEventListener('click', async () => {
        handlePageAction('translate');
    });

    async function handlePageAction(actionType) {
        updateStatus(`Processing ${actionType}...`);
        try {
            // 1. Get active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id) {
                updateStatus('No active tab found.', true);
                return;
            }

            // 2. Get page content (via background script to use scripting.executeScript)
            const pageContentResponse = await chrome.runtime.sendMessage({
                action: 'extractPageContent',
                tabId: tab.id
            });

            if (!pageContentResponse || !pageContentResponse.success) {
                updateStatus(`Error extracting page content: ${pageContentResponse?.error || 'Unknown error'}`, true);
                return;
            }
            const pageData = pageContentResponse.data;
            const textContent = pageData.text; // or pageData.html for full HTML processing

            // 3. Get preferences
            const prefs = await chrome.storage.sync.get(['selectedLanguage', 'selectedSummaryMode']);
            const language = prefs.selectedLanguage || 'en';
            const summaryMode = prefs.selectedSummaryMode || 'bullets';

            // 4. Get API key and provider
            const settings = await chrome.storage.local.get(['userSettings', 'apiKeys']);
            if (!settings.userSettings || !settings.apiKeys) {
                updateStatus('User settings or API keys not configured.', true);
                chrome.runtime.openOptionsPage();
                return;
            }
            const provider = settings.userSettings.defaultProvider;
            const apiKey = settings.apiKeys[provider];

            if (!apiKey) {
                updateStatus(`API key for ${provider} not set. Please configure in options.`, true);
                chrome.runtime.openOptionsPage();
                return;
            }

            // 5. Construct LLM request body (this is a simplified example)
            let prompt;
            // This is a very basic prompt construction.
            // Real prompts will be more sophisticated and handled by core modules.
            switch (actionType) {
                case 'summarize':
                    prompt = `Summarize the following text in ${summaryMode} format (language: ${language}):

${textContent}`;
                    break;
                case 'generateFlashcards':
                    prompt = `Generate flashcards (Q&A format) from the following text (language: ${language}):

${textContent}`;
                    break;
                case 'extractKeywords':
                    prompt = `Extract key terms and concepts from the following text (language: ${language}):

${textContent}`;
                    break;
                case 'translate':
                    prompt = `Translate the following text to ${language}:

${textContent}`;
                    break;
                default:
                    updateStatus('Unknown action type.', true);
                    return;
            }

            let llmRequestBody;
            // Provider-specific payload construction will be in the core module
            // For now, a generic OpenAI-like structure
             if (provider === 'openai') {
                llmRequestBody = {
                    model: 'gpt-3.5-turbo', // This should be configurable
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: actionType === 'summarize' && summaryMode === 'short' ? 80 : 300, // rough estimate
                };
            } else if (provider === 'anthropic') {
                llmRequestBody = {
                    model: 'claude-3-haiku-20240307', // Configurable
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: actionType === 'summarize' && summaryMode === 'short' ? 80 : 300,
                    system: "You are a helpful AI assistant."
                };
            } else if (provider === 'gemini') {
                llmRequestBody = {
                    // Model is part of endpoint for Gemini pro
                    contents: [{ parts: [{text: prompt}] }],
                    generationConfig: { maxOutputTokens: actionType === 'summarize' && summaryMode === 'short' ? 80 : 300 }
                };
            } else {
                updateStatus(`Provider ${provider} not fully supported in this basic handler.`, true);
                return;
            }


            updateStatus(`Sending request to ${provider}...`);

            // 6. Call LLM via background script
            const llmResponse = await chrome.runtime.sendMessage({
                action: 'callLLM',
                data: {
                    provider: provider,
                    body: llmRequestBody,
                    // apiKey is now preferentially fetched by background script from storage
                    // apiKey: apiKey // Can still pass it if needed for override
                }
            });

            if (llmResponse && llmResponse.success) {
                updateStatus(`${actionType} successful!`, false, true);
                // Process and display/store the response (e.g., open in sidebar, new tab, or show in popup)
                // For now, just log it. Actual display will be part of core modules / UI updates.
                console.log(`Response for ${actionType}:`, llmResponse.data);

                // Example: Store result and show in sidebar
                const resultData = {
                    action: actionType,
                    timestamp: new Date().toISOString(),
                    input: textContent.substring(0, 500) + "...", // Store a snippet
                    output: llmResponse.data, // This needs parsing based on provider
                    pageTitle: pageData.title,
                    pageUrl: pageData.url,
                    language: language,
                    summaryMode: actionType === 'summarize' ? summaryMode : undefined
                };
                // Save to history (IndexedDB, managed by sidebar/core module)
                chrome.runtime.sendMessage({ action: 'addToHistory', data: resultData });

                // Display in sidebar (if open) or offer to open
                chrome.runtime.sendMessage({ action: 'displayInSidebar', data: resultData });

                // For quick actions, might show a snippet in the popup itself
                // This needs a dedicated area in popup.html
                // e.g. document.getElementById('resultArea').innerText = processed_llm_output;

            } else {
                updateStatus(`LLM API call failed: ${llmResponse?.error || 'Unknown error'}`, true);
            }

        } catch (error) {
            console.error(`Error in handlePageAction (${actionType}):`, error);
            updateStatus(`Client-side error: ${error.message}`, true);
        }
    }

    updateStatus('Popup ready.');
});
