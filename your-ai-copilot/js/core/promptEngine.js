// your-ai-copilot/js/core/promptEngine.js

import { callLLMProvider } from './llmUtils.js';

/**
 * @file promptEngine.js
 * Manages user-defined prompt templates, fills them with context, and executes them.
 */

/**
 * Processes a user-defined prompt template by filling placeholders and then calling the LLM.
 *
 * @param {string} templateString The user's prompt template string.
 *        Placeholders: {{page}}, {{selection}}, {{transcript}}, {{language}}, {{date}}, {{time}}, {{url}}.
 * @param {object} contextData An object containing data to fill placeholders.
 * @param {string} [contextData.pageText=''] Full text of the current page.
 * @param {string} [contextData.selectedText=''] Currently selected text by the user.
 * @param {string} [contextData.youtubeTranscript=''] Transcript of the current YouTube video.
 * @param {string} [contextData.pageUrl=''] URL of the current page.
 * @param {object} options Configuration options for LLM call.
 * @param {string} [options.provider] - LLM provider.
 * @param {string} [options.model] - Specific LLM model.
 * @param {string} [options.language='en'] - Target language, also available as a placeholder.
 * @param {number} [options.max_tokens] - Max tokens for the response.
 * @param {number} [options.temperature] - Temperature for the LLM call.
 * @returns {Promise<string>} A promise that resolves to the LLM's response to the filled prompt.
 * @throws {Error} If template processing or LLM call fails.
 */
export async function processPromptTemplate(templateString, contextData = {}, options = {}) {
    if (!templateString || typeof templateString !== 'string' || !templateString.trim()) {
        throw new Error("Prompt template string cannot be empty.");
    }

    const settings = await chrome.storage.local.get(['userSettings']);
    const effectiveProvider = options.provider || settings.userSettings?.defaultProvider || 'openai';
    const currentLanguage = options.language || settings.userSettings?.selectedLanguage || 'en';

    const now = new Date();

    // Fill placeholders
    let filledPrompt = templateString;
    filledPrompt = filledPrompt.replace(/\{\{page\}\}/gi, contextData.pageText || '');
    filledPrompt = filledPrompt.replace(/\{\{selection\}\}/gi, contextData.selectedText || '');
    filledPrompt = filledPrompt.replace(/\{\{transcript\}\}/gi, contextData.youtubeTranscript || '');
    filledPrompt = filledPrompt.replace(/\{\{language\}\}/gi, currentLanguage);
    filledPrompt = filledPrompt.replace(/\{\{date\}\}/gi, now.toLocaleDateString());
    filledPrompt = filledPrompt.replace(/\{\{time\}\}/gi, now.toLocaleTimeString());
    filledPrompt = filledPrompt.replace(/\{\{url\}\}/gi, contextData.pageUrl || '');

    // Remove any placeholder that wasn't filled to avoid sending "{{placeholder}}" to LLM
    // Or, one might choose to throw an error if essential placeholders are missing.
    // For now, just remove them.
    filledPrompt = filledPrompt.replace(/\{\{[a-zA-Z0-9_]+\}\}/gi, '');


    if (!filledPrompt.trim()) {
        throw new Error("Filled prompt is empty after replacing placeholders. Check your template and context.");
    }

    const llmOptions = {
        model: options.model,
        max_tokens: options.max_tokens || 800, // Default, can be overridden
        temperature: options.temperature || 0.7,
        system_prompt: options.system_prompt || "You are a helpful AI assistant. Execute the user's instruction provided in the prompt.",
    };

    try {
        console.log(`Executing processed prompt template with ${effectiveProvider}. Filled prompt (start): "${filledPrompt.substring(0, 200)}..."`);
        const response = await callLLMProvider(effectiveProvider, filledPrompt, llmOptions);
        return response;
    } catch (error) {
        console.error(`Error executing prompt template with ${effectiveProvider}:`, error);
        throw new Error(`Failed to execute prompt template: ${error.message}`);
    }
}

/**
 * Retrieves the necessary context data for filling prompts.
 * This function would typically be called before `processPromptTemplate`.
 *
 * @returns {Promise<object>} A promise that resolves to an object with contextData.
 *                           { pageText, selectedText, youtubeTranscript, pageUrl }
 */
export async function getPromptContext() {
    let contextData = {
        pageText: '',
        selectedText: '',
        youtubeTranscript: '',
        pageUrl: ''
    };

    try {
        // Get page content (HTML and text)
        const pageContentResponse = await chrome.runtime.sendMessage({ action: 'extractPageContent' });
        if (pageContentResponse && pageContentResponse.success && pageContentResponse.data) {
            contextData.pageText = pageContentResponse.data.text; // Or .html if preferred
            contextData.pageUrl = pageContentResponse.data.url;
        }

        // Get selected text (requires content script interaction)
        // This often involves chrome.scripting.executeScript to get window.getSelection().toString()
        // We'll assume a message 'getSelectedText' can be sent to a content script.
        // For simplicity, this might need to be initiated from a UI component that has focus.
        // Or, the sidebar/popup might manage selected text state.
        // Let's make a placeholder call, actual implementation might differ.
        try {
            const selectionResponse = await chrome.runtime.sendMessage({ action: 'getSelectedText' });
            if (selectionResponse && selectionResponse.success && selectionResponse.data) {
                contextData.selectedText = selectionResponse.data;
            }
        } catch (selError) {
            console.warn("Could not get selected text for prompt context:", selError.message);
            // It's okay if there's no selection.
        }


        // Get YouTube transcript if on a YouTube page
        if (contextData.pageUrl && contextData.pageUrl.includes('youtube.com/watch')) {
            try {
                const transcriptResponse = await chrome.runtime.sendMessage({ action: 'getYouTubeTranscript' });
                if (transcriptResponse && transcriptResponse.success && transcriptResponse.data) {
                    contextData.youtubeTranscript = transcriptResponse.data;
                }
            } catch (ytError) {
                 console.warn("Could not get YouTube transcript for prompt context:", ytError.message);
            }
        }

    } catch (error) {
        console.error("Error gathering prompt context:", error);
        // Proceed with whatever context was gathered
    }
    return contextData;
}


// Example Usage (conceptual):
//
// async function testPromptEngine() {
//   const template = "Summarize the following page content in {{language}} using no more than 3 sentences:

{{page}}

Is there any mention of 'AI' in the selected text: {{selection}}?";
//   try {
//     // In a real scenario, getPromptContext would be called by the UI (e.g. sidebar)
//     // when the user triggers a custom prompt.
//     const context = await getPromptContext(); // This uses chrome.runtime, so needs to be in extension context
//     console.log("Gathered Context:", context);
//
//     const response = await processPromptTemplate(template, context, { language: 'French' });
//     console.log("Response from custom prompt:", response);
//
//   } catch (error) {
//     console.error("Prompt engine test failed:", error);
//   }
// }
//
// // testPromptEngine(); // Call from a context where chrome APIs are available.
