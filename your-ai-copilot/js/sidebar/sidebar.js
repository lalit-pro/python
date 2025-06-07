// your-ai-copilot/js/sidebar/sidebar.js
document.addEventListener('DOMContentLoaded', () => {
    const sidebarContainer = document.getElementById('sidebar-container');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const resizer = document.getElementById('sidebar-resizer');

    // Tabs
    const tabButtons = document.querySelectorAll('.sidebar-tab-button');
    const tabPanes = document.querySelectorAll('.sidebar-tab-pane');

    // Chat Tab
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const quickActionButtonsChat = document.querySelectorAll('#quick-actions-chat button');

    // History Tab
    const historyList = document.getElementById('history-list');
    const exportHistoryBtn = document.getElementById('exportHistoryBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    // Prompts Tab
    const promptLibrary = document.getElementById('prompt-library');
    const customPromptInput = document.getElementById('customPromptInput');
    const runCustomPromptBtn = document.getElementById('runCustomPromptBtn');

    const statusArea = document.getElementById('sidebar-status').querySelector('p');

    let currentSidebarWidth = 350; // Default width
    let db; // For IndexedDB

    // --- Initialize IndexedDB ---
    function initDB() {
        const request = indexedDB.open('YourAICopilotDB', 1);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode);
            updateStatus("Error initializing database.", true);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("Database initialized successfully.");
            updateStatus("Ready.");
            loadHistory();
            loadPrompts(); // Load predefined prompts
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains('history')) {
                const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
                historyStore.createIndex('timestamp', 'timestamp', { unique: false });
                historyStore.createIndex('action', 'action', { unique: false });
                historyStore.createIndex('pageUrl', 'pageUrl', { unique: false });
            }
            if (!db.objectStoreNames.contains('prompts')) {
                const promptStore = db.createObjectStore('prompts', { keyPath: 'id', autoIncrement: true });
                promptStore.createIndex('name', 'name', { unique: true });
            }
            console.log("Database upgrade complete.");
        };
    }

    // --- Sidebar Visibility & Resizing ---
    function openSidebar() {
        // Injected sidebar is part of the page, not a separate window.
        // Its visibility is controlled by a class or style on its container.
        // This assumes the sidebar HTML is already injected into the page by a content script
        // or loaded within an iframe.
        // For this example, we assume `sidebarContainer` is the top-level element.
        if (sidebarContainer) {
            sidebarContainer.classList.remove('hidden'); // Assuming 'hidden' class controls display:none
            sidebarContainer.style.display = 'flex'; // Or whatever its default display is
            console.log("Sidebar opened.");
        }
    }

    function closeSidebar() {
        if (sidebarContainer) {
            sidebarContainer.classList.add('hidden');
            sidebarContainer.style.display = 'none';
            console.log("Sidebar closed.");
            // Notify background/content script that sidebar is closed
            chrome.runtime.sendMessage({ action: "sidebarClosed" });
        }
    }

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }

    if (resizer) {
        let isResizing = false;
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', () => {
                isResizing = false;
                document.removeEventListener('mousemove', handleMouseMove);
                // Save new width to chrome.storage.sync if needed
                chrome.storage.sync.set({ sidebarWidth: currentSidebarWidth });
            });
        });

        function handleMouseMove(e) {
            if (!isResizing) return;
            let newWidth = window.innerWidth - e.clientX;
            if (newWidth < 250) newWidth = 250; // Min width
            if (newWidth > window.innerWidth * 0.8) newWidth = window.innerWidth * 0.8; // Max width (80% of viewport)
            currentSidebarWidth = newWidth;
            sidebarContainer.style.width = `${currentSidebarWidth}px`;
        }
    }
     // Load stored width
    chrome.storage.sync.get('sidebarWidth', (result) => {
        if (result.sidebarWidth) {
            currentSidebarWidth = result.sidebarWidth;
            sidebarContainer.style.width = `${currentSidebarWidth}px`;
        }
    });


    // --- Tab Functionality ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const tabName = button.getAttribute('data-tab');
            tabPanes.forEach(pane => {
                if (pane.id === `${tabName}-tab-content`) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
            if (tabName === 'history') loadHistory(); // Refresh history when tab is clicked
        });
    });

    // --- Status Update ---
    function updateStatus(message, isError = false) {
        if (statusArea) {
            statusArea.textContent = `Status: ${message}`;
            statusArea.style.color = isError ? '#dc3545' : '#555';
        }
    }

    // --- Chat Functionality ---
    function addMessageToChat(text, sender, type = '') { // type can be 'error', 'welcome'
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        if (sender === 'user') {
            messageDiv.classList.add('user-message');
        } else if (sender === 'ai') {
            messageDiv.classList.add('ai-message');
        } else if (type) {
             messageDiv.classList.add(`${type}-message`);
        }

        // Basic Markdown to HTML (bold, italics, code blocks) - very simplified
        let htmlText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');

        messageDiv.innerHTML = `<p>${htmlText}</p>`; // Use innerHTML for formatted text
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll
    }

    async function handleSendMessage(messageText, context = {}) {
        if (!messageText.trim()) return;

        addMessageToChat(messageText, 'user');
        chatInput.value = ''; // Clear input
        updateStatus("Sending to AI...");

        try {
            const settings = await chrome.storage.local.get(['userSettings', 'apiKeys']);
            if (!settings.userSettings || !settings.apiKeys) {
                addMessageToChat('API settings not configured. Please set them in the extension options.', 'ai', 'error');
                updateStatus("API settings needed.", true);
                return;
            }
            const provider = settings.userSettings.defaultProvider;
            const apiKey = settings.apiKeys[provider];

            if (!apiKey) {
                addMessageToChat(`API key for ${provider} is not set. Please configure in options.`, 'ai', 'error');
                updateStatus(`API key for ${provider} needed.`, true);
                return;
            }

            let pageContentData = context.pageContent;
            if (!pageContentData && (messageText.toLowerCase().includes('page') || messageText.toLowerCase().includes('this document'))) {
                // Attempt to get current page content if not explicitly provided
                const response = await chrome.runtime.sendMessage({ action: 'extractPageContent' });
                if (response && response.success) {
                    pageContentData = response.data;
                } else {
                    addMessageToChat(`Could not get page content: ${response?.error || 'Unknown error'}. Try focusing the desired tab.`, 'ai', 'error');
                    updateStatus("Page content extraction failed.", true);
                    return;
                }
            }

            let prompt = messageText;
            if (pageContentData && pageContentData.text) {
                 // Simple context injection. More sophisticated needed for long texts (chunking etc.)
                prompt = `Context from the current page (first 2000 chars):
"${pageContentData.text.substring(0, 2000)}..."

User query: ${messageText}`;
            }
            if (context.transcript) {
                 prompt = `Context from YouTube video transcript (first 2000 chars):
"${context.transcript.substring(0, 2000)}..."

User query: ${messageText}`;
            }


            let llmRequestBody;
            // This will be replaced by core module logic
            if (provider === 'openai') {
                llmRequestBody = { model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: prompt }], max_tokens: 500 };
            } else if (provider === 'anthropic') {
                llmRequestBody = { model: 'claude-3-haiku-20240307', messages: [{ role: 'user', content: prompt }], max_tokens: 500, system: "You are a helpful AI assistant." };
            } else if (provider === 'gemini') {
                llmRequestBody = { contents: [{ parts: [{text: prompt}] }], generationConfig: { maxOutputTokens: 500 }};
            } else {
                 addMessageToChat(`Provider ${provider} not fully supported for chat.`, 'ai', 'error');
                 updateStatus(`Unsupported provider ${provider}.`, true);
                 return;
            }


            const llmResponse = await chrome.runtime.sendMessage({
                action: 'callLLM',
                data: { provider, body: llmRequestBody /* apiKey will be fetched by background */ }
            });

            if (llmResponse && llmResponse.success) {
                let aiText = "Could not parse AI response.";
                if (provider === 'openai' && llmResponse.data.choices && llmResponse.data.choices[0]) {
                    aiText = llmResponse.data.choices[0].message.content;
                } else if (provider === 'anthropic' && llmResponse.data.content && llmResponse.data.content[0]) {
                    aiText = llmResponse.data.content[0].text;
                } else if (provider === 'gemini' && llmResponse.data.candidates && llmResponse.data.candidates[0]) {
                    aiText = llmResponse.data.candidates[0].content.parts[0].text;
                }
                addMessageToChat(aiText, 'ai');
                updateStatus("Response received.");
                saveToHistory({
                    action: 'chat',
                    input: messageText,
                    output: aiText,
                    pageTitle: pageContentData?.title,
                    pageUrl: pageContentData?.url,
                    timestamp: new Date().toISOString()
                });
            } else {
                addMessageToChat(`Error from AI: ${llmResponse?.error || 'Unknown error'}`, 'ai', 'error');
                updateStatus("AI call failed.", true);
            }

        } catch (error) {
            console.error("Error sending message:", error);
            addMessageToChat(`Client-side error: ${error.message}`, 'ai', 'error');
            updateStatus("Error.", true);
        }
    }

    if (sendMessageBtn && chatInput) {
        sendMessageBtn.addEventListener('click', () => handleSendMessage(chatInput.value));
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(chatInput.value);
            }
        });
        // Auto-resize textarea
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = (chatInput.scrollHeight) + 'px';
        });
    }

    quickActionButtonsChat.forEach(button => {
        button.addEventListener('click', async () => {
            const action = button.getAttribute('data-action');
            updateStatus(`Performing ${action}...`);
            let contextText = ""; // This will be passed to handleSendMessage or a dedicated handler

            try {
                const response = await chrome.runtime.sendMessage({ action: 'extractPageContent' });
                if (response && response.success && response.data) {
                    contextText = response.data.text; // Or response.data if passing the whole object
                     let promptForLlm = "";
                    if (action === 'summarize') {
                        promptForLlm = `Please summarize the current page content.`;
                    } else if (action === 'keywords') {
                        promptForLlm = `Extract the main keywords and concepts from the current page content.`;
                    } else if (action === 'qa_page') {
                        // For Q&A, we might just load the context and let the user type their question
                        addMessageToChat("Page context loaded. What's your question about it?", 'ai');
                        chatInput.focus();
                        updateStatus("Page context loaded for Q&A.");
                        // Store context for next message
                        // This needs a more robust state management if we want to preserve context across turns
                        // For now, let's assume handleSendMessage will re-fetch if needed or use a global var
                        return; // Don't send to LLM yet
                    }
                     handleSendMessage(promptForLlm, { pageContent: response.data });


                } else {
                    addMessageToChat(`Could not get page content for ${action}: ${response?.error || 'Unknown error'}`, 'ai', 'error');
                    updateStatus(`Failed to get page content for ${action}.`, true);
                }
            } catch (e) {
                 addMessageToChat(`Error during quick action ${action}: ${e.message}`, 'ai', 'error');
                 updateStatus(`Error during ${action}.`, true);
            }
        });
    });


    // --- History Functionality ---
    function saveToHistory(item) {
        if (!db) {
            console.warn("DB not initialized, cannot save history.");
            return;
        }
        const transaction = db.transaction(['history'], 'readwrite');
        const store = transaction.objectStore('history');
        const request = store.add(item);

        request.onsuccess = () => {
            console.log("Item added to history:", item);
            if (document.querySelector('.sidebar-tab-button[data-tab="history"].active')) {
                loadHistory(); // Refresh if history tab is active
            }
        };
        request.onerror = (event) => {
            console.error("Error adding item to history:", event.target.error);
        };
    }

    function loadHistory() {
        if (!db) {
            historyList.innerHTML = "<p>Database not available.</p>";
            return;
        }
        const transaction = db.transaction(['history'], 'readonly');
        const store = transaction.objectStore('history');
        const index = store.index('timestamp'); // Sort by timestamp
        const getAllRequest = index.getAll(null, 'prev'); // Get all, sort descending by timestamp

        historyList.innerHTML = '<p>Loading history...</p>'; // Clear current list

        getAllRequest.onsuccess = () => {
            const items = getAllRequest.result;
            if (items.length === 0) {
                historyList.innerHTML = "<p>No history yet.</p>";
                return;
            }
            historyList.innerHTML = ""; // Clear loading message
            items.forEach(item => {
                const div = document.createElement('div');
                div.classList.add('history-item');
                const outputPreview = typeof item.output === 'string' ? item.output : JSON.stringify(item.output, null, 2);

                div.innerHTML = `
                    <h4>${item.action || 'Chat'} (${new Date(item.timestamp).toLocaleDateString()})</h4>
                    <p><strong>Input:</strong> ${item.input ? item.input.substring(0,100)+'...' : 'N/A'}</p>
                    <p><strong>Output:</strong> ${outputPreview.substring(0, 150)}...</p>
                    <small>URL: ${item.pageUrl ? item.pageUrl.substring(0,50)+'...' : 'N/A'}</small>
                    <div class="actions">
                        <button data-id="${item.id}" class="view-history-item">View</button>
                        <button data-id="${item.id}" class="delete-history-item">Delete</button>
                    </div>
                `;
                historyList.appendChild(div);
            });

            document.querySelectorAll('.view-history-item').forEach(btn => {
                btn.addEventListener('click', (e) => viewHistoryItem(parseInt(e.target.dataset.id)));
            });
            document.querySelectorAll('.delete-history-item').forEach(btn => {
                btn.addEventListener('click', (e) => deleteHistoryItem(parseInt(e.target.dataset.id)));
            });
        };
        getAllRequest.onerror = (event) => {
            console.error("Error loading history:", event.target.error);
            historyList.innerHTML = "<p>Error loading history.</p>";
        };
    }

    function viewHistoryItem(id) {
        if (!db) return;
        const transaction = db.transaction(['history'], 'readonly');
        const store = transaction.objectStore('history');
        const request = store.get(id);

        request.onsuccess = () => {
            const item = request.result;
            if (item) {
                // For now, just log. A modal or dedicated view would be better.
                console.log("View history item:", item);
                addMessageToChat(`Input: ${item.input}
Output: ${typeof item.output === 'string' ? item.output : JSON.stringify(item.output, null, 2)}`, 'ai', 'history-log');
                // Switch to chat tab to show it
                document.querySelector('.sidebar-tab-button[data-tab="chat"]').click();
            }
        };
    }

    function deleteHistoryItem(id) {
        if (!db) return;
        const transaction = db.transaction(['history'], 'readwrite');
        const store = transaction.objectStore('history');
        const request = store.delete(id);
        request.onsuccess = () => {
            console.log(`History item ${id} deleted.`);
            loadHistory(); // Refresh list
        };
        request.onerror = (e) => console.error("Error deleting history item:", e.target.error);
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            if (!db) return;
            if (confirm("Are you sure you want to clear all history? This cannot be undone.")) {
                const transaction = db.transaction(['history'], 'readwrite');
                const store = transaction.objectStore('history');
                const request = store.clear();
                request.onsuccess = () => {
                    console.log("History cleared.");
                    loadHistory();
                    updateStatus("History cleared.");
                };
                 request.onerror = (e) => {
                    console.error("Error clearing history:", e.target.error);
                    updateStatus("Error clearing history.", true);
                };
            }
        });
    }

    if (exportHistoryBtn) {
        exportHistoryBtn.addEventListener('click', () => {
            if (!db) return;
            const transaction = db.transaction(['history'], 'readonly');
            const store = transaction.objectStore('history');
            const request = store.getAll();

            request.onsuccess = () => {
                const data = JSON.stringify(request.result, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'yourai_copilot_history.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                updateStatus("History exported.");
            };
            request.onerror = (e) => {
                console.error("Error exporting history:", e.target.error);
                updateStatus("Error exporting history.", true);
            }
        });
    }

    // --- Prompts Functionality ---
    const DEFAULT_PROMPTS = [
        { name: "Summarize (Bullets)", template: "Summarize the following content into bullet points:

{{page}}" },
        { name: "Explain Like I'm 5", template: "Explain the core concepts of the following content as if I were 5 years old:

{{page}}" },
        { name: "Identify Key Arguments", template: "What are the key arguments or claims made in this text?

{{page}}" },
        { name: "Translate to Spanish", template: "Translate the selected text to Spanish:

{{selection}}" }
    ];

    async function loadPrompts() {
        if (!db) {
            promptLibrary.innerHTML = "<p>Database not available for prompts.</p>";
            return;
        }
        const transaction = db.transaction(['prompts'], 'readwrite'); // readwrite to add defaults
        const store = transaction.objectStore('prompts');

        store.count().onsuccess = (event) => {
            if (event.target.result === 0) { // Add defaults if store is empty
                DEFAULT_PROMPTS.forEach(p => store.add(p));
            }
        };

        const getAllRequest = store.getAll();
        promptLibrary.innerHTML = ""; // Clear

        getAllRequest.onsuccess = () => {
            const prompts = getAllRequest.result;
            if (prompts.length === 0) {
                 // This case should be rare if defaults are added above
                DEFAULT_PROMPTS.forEach(p => { // Display defaults directly if DB somehow failed to populate
                    const div = document.createElement('div');
                    div.classList.add('prompt-item');
                    div.textContent = p.name;
                    div.onclick = () => customPromptInput.value = p.template;
                    promptLibrary.appendChild(div);
                });
                return;
            }
            prompts.forEach(prompt => {
                const div = document.createElement('div');
                div.classList.add('prompt-item');
                div.textContent = prompt.name;
                div.onclick = () => customPromptInput.value = prompt.template;
                promptLibrary.appendChild(div);
            });
        };
         getAllRequest.onerror = (e) => console.error("Error loading prompts:", e.target.error);
    }

    if(runCustomPromptBtn) {
        runCustomPromptBtn.addEventListener('click', async () => {
            let template = customPromptInput.value;
            if (!template.trim()) {
                addMessageToChat("Custom prompt is empty.", 'ai', 'error');
                return;
            }

            updateStatus("Processing custom prompt...");

            // Get page content, selection, etc.
            let pageText = "", selectionText = "", transcriptText = "";
            const language = (await chrome.storage.sync.get('selectedLanguage')).selectedLanguage || 'en';

            try {
                const pageResponse = await chrome.runtime.sendMessage({ action: 'extractPageContent' });
                if (pageResponse && pageResponse.success) pageText = pageResponse.data.text;

                // How to get selection? Content script needs to provide it.
                // For now, assume it's not available or passed explicitly.
                // A better way: message content script to get current selection.
                // chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                //    chrome.scripting.executeScript({ target: {tabId: tabs[0].id }, func: () => window.getSelection().toString() }, (results) => {
                //        if (results && results[0] && results[0].result) selectionText = results[0].result;
                //    });
                // });
                // This is async, so it complicates the flow. A dedicated "getSelection" message is better.

                // For transcript, similar logic if on YouTube.
                // const transcriptResponse = await chrome.runtime.sendMessage({ action: 'getYouTubeTranscript' });
                // if (transcriptResponse && transcriptResponse.success) transcriptText = transcriptResponse.data;


                let filledPrompt = template
                    .replace(/\{\{page\}\}/gi, pageText || "No page content available.")
                    .replace(/\{\{selection\}\}/gi, selectionText || "No text selected.")
                    .replace(/\{\{transcript\}\}/gi, transcriptText || "No transcript available.")
                    .replace(/\{\{language\}\}/gi, language);

                // Switch to chat tab and send
                document.querySelector('.sidebar-tab-button[data-tab="chat"]').click();
                handleSendMessage(filledPrompt);
                customPromptInput.value = ""; // Clear after use
            } catch (error) {
                console.error("Error processing custom prompt:", error);
                addMessageToChat(`Error with custom prompt: ${error.message}`, 'ai', 'error');
                updateStatus("Custom prompt error.", true);
            }
        });
    }


    // --- Message Listener from other parts of the extension ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("Sidebar received message:", request);
        if (request.action === "toggleSidebar") {
            if (sidebarContainer.style.display === 'none' || sidebarContainer.classList.contains('hidden')) {
                openSidebar();
                if(request.contextText) { // If context text is passed (e.g., from context menu)
                    chatInput.value = `Regarding the selected text ("${request.contextText.substring(0,100)}..."):
`;
                    chatInput.focus();
                } else if (request.context === 'qa') {
                     // Potentially pre-fill or set a mode for Q&A
                }
            } else {
                closeSidebar();
            }
            sendResponse({ success: true, isVisible: sidebarContainer.style.display !== 'none' });
        } else if (request.action === "displayInSidebar") {
            // Make sure sidebar is open
            openSidebar();
            // Switch to chat tab
            document.querySelector('.sidebar-tab-button[data-tab="chat"]').click();
            // Display the data. This is a simplified display.
            const { action, output, pageTitle } = request.data;
            let displayOutput = output;
            if (typeof output === 'object') {
                // Try to get meaningful text from LLM response structure
                const currentProvider = (async () => (await chrome.storage.local.get('userSettings')).userSettings?.defaultProvider || 'openai')(); // Immediately invoked async function to get provider
                // This is a bit of a hack due to not being able to use await directly in the listener's synchronous part.
                // A better way would be to make this part of the message handler async or pass provider from sender.
                (async () => { // IIFE to use await
                    const provider = await currentProvider;
                    if (provider === 'openai' && output.choices && output.choices[0]) {
                        displayOutput = output.choices[0].message.content;
                    } else if (provider === 'anthropic' && output.content && output.content[0]) {
                        displayOutput = output.content[0].text;
                    } else if (provider === 'gemini' && output.candidates && output.candidates[0]) {
                        displayOutput = output.candidates[0].content.parts[0].text;
                    } else {
                        displayOutput = JSON.stringify(output, null, 2); // Fallback
                    }
                    addMessageToChat(`Result for "${action}" on page "${pageTitle}":
${displayOutput}`, 'ai');
                })();
            } else {
                 addMessageToChat(`Result for "${action}" on page "${pageTitle}":
${displayOutput}`, 'ai');
            }
            sendResponse({ success: true });
        } else if (request.action === 'addToHistory') { // From popup.js for example
            saveToHistory(request.data);
            sendResponse({ success: true });
        }
        return true; // Keep channel open for async response if needed
    });


    // --- Initializations ---
    initDB();
    // Sidebar may be hidden by default, shown by user action or message
    // For development, you might want to show it:
    // openSidebar();

    // Check if sidebar should be open based on last state (optional)
    chrome.storage.local.get('sidebarOpen', (result) => {
        if (result.sidebarOpen) {
            openSidebar();
        } else {
            // It might be better to have it closed by default
            // and only open on user action (toolbar icon, context menu)
            // For now, if not explicitly set to open, keep it hidden/closed.
             closeSidebar(); // Ensure it's hidden if not explicitly set to open
        }
    });
});
