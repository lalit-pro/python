// your-ai-copilot/js/background/background.js

// --- Offscreen Document Management (Add this section to background.js) ---
const OFFSCREEN_DOCUMENT_PATH = 'html/offscreen.html';
let creatingOffscreenDocument; // Promise to prevent multiple creation attempts

async function hasOffscreenDocument() {
    // Check if an offscreen document is already active.
    // Requires Chrome 116+ for clients.matchAll
    if (typeof clients === 'undefined' || !clients.matchAll) {
        // Fallback for older versions or different environments if necessary
        // This might involve trying to send a message and seeing if it resolves
        console.warn("clients.matchAll not available to check for offscreen document.");
        // A simple but less reliable check:
        const contexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT']
        });
        return contexts.length > 0;
    }
    const matchedClients = await clients.matchAll({
        type: 'offscreen',
        includeUncontrolled: true // May not be necessary depending on use case
    });
    return matchedClients.length > 0;
}

async function setupOffscreenDocument() {
    if (await hasOffscreenDocument()) {
        console.log("Offscreen document already exists.");
        return;
    }

    if (creatingOffscreenDocument) {
        await creatingOffscreenDocument;
        return;
    }

    creatingOffscreenDocument = chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [chrome.offscreen.Reason.DOM_PARSER], // DOM_SCRAPING when it becomes available, use DOM_PARSER for now
        justification: 'Needed for fetching and parsing external page content for monitors.',
    });

    try {
        await creatingOffscreenDocument;
        console.log("Offscreen document created successfully.");
    } catch (error) {
        console.error("Failed to create offscreen document:", error);
    } finally {
        creatingOffscreenDocument = null;
    }
}


// --- Globals ---
const LLM_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', // Example endpoint
};

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000; // 1 second

// --- Helper Functions ---

/**
 * Fetches data from an LLM API with rate limiting and exponential backoff.
 * @param {string} provider - 'openai', 'anthropic', or 'gemini'.
 * @param {object} requestBody - The request body for the LLM API.
 * @param {string} apiKey - The API key for the provider.
 * @returns {Promise<object>} The JSON response from the API.
 */
async function fetchLLM(provider, requestBody, apiKey) {
  let attempts = 0;
  let backoff = INITIAL_BACKOFF_MS;

  const endpoint = LLM_ENDPOINTS[provider];
  if (!endpoint) {
    console.error(`Invalid LLM provider: ${provider}`);
    throw new Error(`Invalid LLM provider: ${provider}`);
  }

  // Add Gemini API key to endpoint if it's the provider
  const effectiveEndpoint = provider === 'gemini' ? `${endpoint}?key=${apiKey}` : endpoint;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (provider === 'openai') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01'; // Required by Anthropic
  }
  // Gemini API key is in the URL, specific headers might be needed for other providers if not using their client libraries

  while (attempts < MAX_RETRIES) {
    try {
      const response = await fetch(effectiveEndpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
      });

      if (response.status === 429 || response.status >= 500) { // Rate limit or server error
        console.warn(`API request failed with status ${response.status}. Retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        backoff *= 2; // Exponential backoff
        attempts++;
      } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        console.error(`API request failed with status ${response.status}:`, errorData);
        throw new Error(`API request failed: ${response.status} ${response.statusText}. Details: ${JSON.stringify(errorData)}`);
      } else {
        return await response.json();
      }
    } catch (error) {
      console.error(`Error during fetchLLM attempt ${attempts + 1}:`, error);
      if (attempts + 1 >= MAX_RETRIES) {
        throw error; // Rethrow if max retries reached
      }
      await new Promise(resolve => setTimeout(resolve, backoff));
      backoff *= 2;
      attempts++;
    }
  }
  throw new Error('Max retries reached for LLM API request.');
}

/**
 * Caches data to chrome.storage.local.
 * @param {string} key - The key for the data.
 * @param {any} value - The value to cache.
 * @returns {Promise<void>}
 */
async function cacheData(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
    console.log(`Data cached for key: ${key}`);
  } catch (error) {
    console.error(`Error caching data for key ${key}:`, error);
  }
}

/**
 * Retrieves cached data from chrome.storage.local.
 * @param {string} key - The key for the data to retrieve.
 * @returns {Promise<any>} The cached value, or undefined if not found.
 */
async function getCachedData(key) {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key];
  } catch (error) {
    console.error(`Error retrieving cached data for key ${key}:`, error);
    return undefined;
  }
}

// --- Event Listeners ---

chrome.runtime.onStartup.addListener(async () => {
    console.log("Extension startup.");
    await setupOffscreenDocument();
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('YourAI Copilot extension installed.');
  // Initialize default settings or perform first-time setup
  chrome.storage.local.get(['userSettings', 'apiKeys'], (result) => {
    if (!result.userSettings) {
      chrome.storage.local.set({
        userSettings: {
          defaultProvider: 'openai',
          featureFlags: {
            summarization: true,
            qa: true,
            flashcards: true,
            keywords: true,
            translation: true,
            pageMonitors: true,
          }
        }
      });
    }
    if (!result.apiKeys) {
      chrome.storage.local.set({ apiKeys: { openai: '', anthropic: '', gemini: '' } });
    }
  });

  // Context Menus
  chrome.contextMenus.create({
    id: "summarizeSelectedText",
    title: "Summarize selected text with YourAI",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "askWithSelectedText",
    title: "Ask YourAI about selected text",
    contexts: ["selection"]
  });
  await setupOffscreenDocument(); // Add this line
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in background:', request);

  if (request.action === 'callLLM') {
    const { provider, body, apiKey } = request.data;
    if (!apiKey) {
        // Try to get API key from storage if not provided directly
        chrome.storage.local.get('apiKeys', (result) => {
            const storedApiKeys = result.apiKeys;
            const keyToUse = storedApiKeys ? storedApiKeys[provider] : null;
            if (!keyToUse) {
                console.error(`API key for ${provider} not found.`);
                sendResponse({ error: `API key for ${provider} not found. Please set it in the options page.` });
                return; // Must return true for async sendResponse, but here we send error sync
            }
            fetchLLM(provider, body, keyToUse)
                .then(response => sendResponse({ success: true, data: response }))
                .catch(error => sendResponse({ success: false, error: error.message }));
        });
        return true; // Indicates that sendResponse will be called asynchronously
    } else {
        // API key provided directly in the message
        fetchLLM(provider, body, apiKey)
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Indicates that sendResponse will be called asynchronously
    }
  } else if (request.action === 'cacheData') {
    const { key, value } = request.data;
    cacheData(key, value)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async
  } else if (request.action === 'getCachedData') {
    const { key } = request.data;
    getCachedData(key)
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async
  } else if (request.action === 'fetchPageElementForMonitor') { // Add this else if block
    (async () => { // Wrap in async IIFE to use await
        await setupOffscreenDocument(); // Ensure offscreen document is ready
        if (!(await hasOffscreenDocument())) {
            sendResponse({ success: false, error: "Offscreen document not available." });
            return;
        }
        try {
            const offscreenResponse = await chrome.runtime.sendMessage({
                target: 'offscreen', // Important: identify the target
                action: 'fetchPageElement', // Action for the offscreen script
                data: request.data
            });
            sendResponse(offscreenResponse);
        } catch (error) {
            console.error("Error communicating with offscreen document:", error);
            sendResponse({ success: false, error: `Failed to get response from offscreen document: ${error.message}` });
        }
    })();
    return true; // Indicates async response
  } else if (request.action === 'extractPageContent') {
    // Forward to active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: () => {
            // This function is executed in the content script context
            return {
              html: document.documentElement.outerHTML,
              text: document.body.innerText,
              title: document.title,
              url: window.location.href
            };
          }
        }, (injectionResults) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else if (injectionResults && injectionResults[0] && injectionResults[0].result) {
            sendResponse({ success: true, data: injectionResults[0].result });
          } else {
            sendResponse({ success: false, error: "Failed to extract page content." });
          }
        });
      } else {
        sendResponse({ success: false, error: "No active tab found." });
      }
    });
    return true; // Async
  } else if (request.action === 'getYouTubeTranscript') {
    // Forward to active YouTube tab's content script
     chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id && tabs[0].url && tabs[0].url.includes("youtube.com/watch")) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getTranscript" }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else if (response && response.success) {
            sendResponse({ success: true, data: response.data });
          } else {
            sendResponse({ success: false, error: (response && response.error) || "Failed to get YouTube transcript." });
          }
        });
      } else {
        sendResponse({ success: false, error: "Not a YouTube video page or no active tab." });
      }
    });
    return true; // Async
  }

  // Default response for unhandled actions
  // sendResponse({ success: false, error: 'Unknown action' });
  // return false; // Synchronous response or no response needed
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) {
    console.error("Context menu clicked without a valid tab.");
    return;
  }
  if (info.menuItemId === "summarizeSelectedText") {
    if (info.selectionText) {
      // Send a message to the popup or trigger a direct LLM call
      // For simplicity, let's assume the popup handles this by being opened
      // or we can directly message the content script to show a UI or send to background
      console.log("Selected text to summarize:", info.selectionText);
      // Example: Directly call LLM (requires API key management)
      // This would typically be handled by the popup or sidebar UI to select provider etc.
      // For now, just log it. UI interaction will be built later.
      chrome.storage.local.get(['apiKeys', 'userSettings'], (result) => {
        const { apiKeys, userSettings } = result;
        if (userSettings && apiKeys && apiKeys[userSettings.defaultProvider]) {
          const provider = userSettings.defaultProvider;
          const apiKey = apiKeys[provider];
          const body = { /* ... construct body for summarization ... */
            model: provider === 'openai' ? 'gpt-3.5-turbo' : (provider === 'anthropic' ? 'claude-3-haiku-20240307' : 'gemini-pro'), // Example models
            messages: [{ role: 'user', content: `Summarize this text: ${info.selectionText}` }],
            max_tokens: 150
          };
          if (provider === 'anthropic') { // Anthropic specific structure
            body.system = "You are a helpful summarization assistant.";
            body.messages = [{role: "user", content: `Summarize this text: ${info.selectionText}`}];
          } else if (provider === 'gemini') { // Gemini specific structure
             body.contents = [{ parts: [{text: `Summarize this text: ${info.selectionText}`}] }];
             delete body.messages; // Gemini uses 'contents'
             delete body.model; // Model is part of endpoint for Gemini
             delete body.max_tokens; // Gemini uses generationConfig
             body.generationConfig = { maxOutputTokens: 150 };
          }

          fetchLLM(provider, body, apiKey)
            .then(summary => console.log("Summary from context menu:", summary))
            .catch(error => console.error("Error summarizing from context menu:", error));
        } else {
          console.warn("Default API key or provider not set for context menu summarization.");
          // Optionally, open the options page or notify the user
           chrome.runtime.sendMessage({ action: "showNotification", message: "Please set your API keys in the options to use summarization." });
        }
      });
    }
  } else if (info.menuItemId === "askWithSelectedText") {
    // This would typically open the sidebar/popup with the selected text pre-filled
    console.log("Selected text to ask about:", info.selectionText);
    // Store selected text and signal popup/sidebar to use it
    chrome.storage.local.set({ contextSelection: info.selectionText });
    // Open sidebar or popup (if popup is preferred for this action)
    // chrome.action.openPopup(); // This API is not available for service workers.
    // We might need to message a content script to open the sidebar, or rely on user clicking the action icon.
    // For now, we'll just log it. The UI part will handle this.
    chrome.runtime.sendMessage({ action: "showSidebar", contextText: info.selectionText });

  }
});


// --- Initialization and Alarms (Example for page monitors) ---
// This is a placeholder for where page monitor logic would go.
// It would involve setting alarms and then checking pages when alarms fire.

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("pageMonitor_")) {
    const monitorId = alarm.name.substring("pageMonitor_".length);
    console.log(`Alarm fired for page monitor: ${monitorId}`);
    // TODO: Implement logic to fetch page content and check for changes
    // This would involve:
    // 1. Getting the monitor details (URL, selector, last content) from storage.
    // 2. Fetching the current page content (might need scripting permission or fetch API).
    // 3. Comparing with stored content.
    // 4. Notifying user or calling webhook if changes detected.
  }
});

console.log("Background service worker started.");

// Keep the service worker alive during long-running LLM calls if necessary
// This is a common pattern, but use sparingly as it consumes resources.
// For Manifest V3, long-running tasks are better handled by offscreen documents
// or by ensuring messages are passed frequently.
// For now, we assume LLM calls are relatively quick or handled by user interaction.

// Example of how to keep alive for a short period if needed:
let keepAliveInterval;

chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'keepAlive') {
    keepAliveInterval = setInterval(() => {
      port.postMessage({ message: 'ping' });
    }, 25 * 1000); // Send a message every 25 seconds
    port.onDisconnect.addListener(() => {
      clearInterval(keepAliveInterval);
    });
  }
});

/**
 * Example function to demonstrate fetching API key from storage.
 * This would be called by functions needing an API key.
 */
async function getApiKey(provider) {
  const result = await chrome.storage.local.get('apiKeys');
  if (result.apiKeys && result.apiKeys[provider]) {
    return result.apiKeys[provider];
  }
  return null;
}

// Example of how to use the LLM call from another part of the background script
async function exampleSummarize(textToSummarize) {
  try {
    const settings = await chrome.storage.local.get(['userSettings', 'apiKeys']);
    const provider = settings.userSettings?.defaultProvider || 'openai';
    const apiKey = settings.apiKeys?.[provider];

    if (!apiKey) {
      console.error(`API key for ${provider} is not set.`);
      // Notify user to set API key
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon128.png',
        title: 'API Key Needed',
        message: `Please set your API key for ${provider} in the extension options.`
      });
      return null;
    }

    let requestBody;
    if (provider === 'openai') {
      requestBody = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: `Summarize: ${textToSummarize}` }],
        max_tokens: 100,
      };
    } else if (provider === 'anthropic') {
      requestBody = {
        model: 'claude-3-haiku-20240307', // Example model
        messages: [{ role: 'user', content: `Summarize: ${textToSummarize}` }],
        max_tokens: 100, // Anthropic uses max_tokens_to_sample in older versions, now max_tokens
        system: "You are a helpful assistant that summarizes text."
      };
    } else if (provider === 'gemini') {
        requestBody = {
            contents: [{ parts: [{text: `Summarize: ${textToSummarize}`}] }],
            generationConfig: { maxOutputTokens: 100 }
        };
    } else {
        console.error("Unsupported provider for summarization example.");
        return null;
    }

    console.log(`Requesting summary from ${provider}...`);
    const summaryResponse = await fetchLLM(provider, requestBody, apiKey);
    console.log('Summary response:', summaryResponse);

    // Process the response according to each provider's format
    let summaryText = '';
    if (provider === 'openai' && summaryResponse.choices && summaryResponse.choices[0]) {
      summaryText = summaryResponse.choices[0].message.content;
    } else if (provider === 'anthropic' && summaryResponse.content && summaryResponse.content[0]) {
      summaryText = summaryResponse.content[0].text;
    } else if (provider === 'gemini' && summaryResponse.candidates && summaryResponse.candidates[0]) {
        summaryText = summaryResponse.candidates[0].content.parts[0].text;
    }


    // Cache the summary (example)
    await cacheData(`summary_${Date.now()}`, { original: textToSummarize, summary: summaryText });
    return summaryText;

  } catch (error) {
    console.error('Error in exampleSummarize:', error);
    // Notify user of error
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icons/icon128.png',
        title: 'Summarization Error',
        message: `Could not get summary: ${error.message}`
      });
    return null;
  }
}

// Self-test on startup (optional)
// (async () => {
//   console.log("Performing background script self-test...");
//   const testText = "This is a test sentence to check if the summarization setup is working correctly.";
//   // await exampleSummarize(testText); // Commented out to avoid actual API call on startup without keys
//   console.log("Self-test sequence complete. Ensure API keys are set for actual LLM calls.");
// })();
