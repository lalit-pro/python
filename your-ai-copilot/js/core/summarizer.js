// your-ai-copilot/js/core/summarizer.js

import { callLLMProvider } from './llmUtils.js';

/**
 * @file summarizer.js
 * Handles text summarization tasks using LLMs.
 */

/**
 * Summarizes a given text using the configured LLM provider.
 *
 * @param {string} textToSummarize The text content to be summarized.
 * @param {object} options Configuration options for summarization.
 * @param {string} [options.provider] - Specific LLM provider to use (e.g., 'openai'). Defaults to user's default.
 * @param {string} [options.model] - Specific model to use.
 * @param {string} [options.summaryLength='medium'] - Desired length: 'short', 'medium', 'bullets', 'paragraph'.
 * @param {string} [options.language='en'] - Target language for the summary.
 * @param {string} [options.customPrompt] - A custom prompt template if provided.
 * @returns {Promise<string>} A promise that resolves to the summarized text.
 * @throws {Error} If summarization fails.
 */
export async function summarizeText(textToSummarize, options = {}) {
    if (!textToSummarize || typeof textToSummarize !== 'string' || !textToSummarize.trim()) {
        throw new Error("Text to summarize cannot be empty.");
    }

    // Retrieve default provider and API key from storage via background or settings
    // For this module, we assume 'provider' will be passed or determined by a higher-level function
    // that has access to user settings.
    const settings = await chrome.storage.local.get(['userSettings']);
    const effectiveProvider = options.provider || settings.userSettings?.defaultProvider || 'openai';

    let prompt;
    if (options.customPrompt) {
        prompt = options.customPrompt.replace(/\{\{text\}\}/gi, textToSummarize)
                                     .replace(/\{\{language\}\}/gi, options.language || 'English');
    } else {
        const lengthInstructions = {
            short: "a very short summary (1-2 sentences)",
            medium: "a concise summary",
            bullets: "a summary in bullet points",
            paragraph: "a summary in a single paragraph",
        };
        const lengthDesc = lengthInstructions[options.summaryLength] || lengthInstructions['medium'];
        const languageDesc = options.language ? ` in ${options.language}` : "";

        prompt = `Please provide ${lengthDesc} of the following text${languageDesc}:

"${textToSummarize}"`;
    }

    const llmOptions = {
        model: options.model, // Provider-specific default will be used if null
        max_tokens: options.summaryLength === 'short' ? 100 : (options.summaryLength === 'bullets' ? 300 : 200),
        temperature: 0.5, // Lower temperature for more factual summaries
        system_prompt: `You are an expert summarization assistant. Your goal is to provide clear, concise, and accurate summaries based on the user's length and language preferences. Output only the summary text itself.`,
    };

    try {
        console.log(`Requesting summary from ${effectiveProvider} with prompt: "${prompt.substring(0,100)}..."`);
        const summary = await callLLMProvider(effectiveProvider, prompt, llmOptions);

        // Basic post-processing (optional)
        // For example, ensure bullet points start correctly if that was requested.
        if (options.summaryLength === 'bullets' && !summary.trim().startsWith('-') && !summary.trim().startsWith('*')) {
            // This is a naive check, LLM should ideally format correctly.
            // console.warn("LLM did not start bullet summary with a bullet point.");
        }
        return summary;
    } catch (error) {
        console.error(`Error during summarization with ${effectiveProvider}:`, error);
        throw new Error(`Failed to summarize text: ${error.message}`);
    }
}

/**
 * Summarizes the content of a given URL.
 * (Conceptual: This would require fetching page content first)
 *
 * @param {string} url The URL of the page to summarize.
 * @param {object} options Summarization options (see summarizeText).
 * @returns {Promise<string>} A promise that resolves to the summarized text.
 */
export async function summarizeUrl(url, options = {}) {
    // 1. Fetch page content (this logic would typically be in a background script or use existing mechanisms)
    //    For this example, we'll assume page text is passed to summarizeText directly.
    //    A real implementation would call `chrome.runtime.sendMessage({ action: 'extractPageContent', urlToFetch: url })`
    //    or use `scripting.executeScript` if called from background with tabId.
    console.warn("summarizeUrl is conceptual. Page content fetching needs to be implemented.");
    throw new Error("summarizeUrl requires page content fetching capability, which is not implemented in this standalone module example. Use summarizeText with fetched content.");

    // Placeholder for where page content would be fetched:
    // const pageText = await fetchPageText(url); // Imaginary function
    // return summarizeText(pageText, options);
}


// Example Usage (conceptual):
//
// async function testSummarization() {
//   const sampleText = "The quick brown fox jumps over the lazy dog. This is a classic sentence used for testing typewriters and fonts. It contains all letters of the English alphabet. The dog, being lazy, did not react much to the agile fox.";
//   try {
//     // Assuming user settings are available (e.g., default provider is 'openai')
//     const shortSummary = await summarizeText(sampleText, { summaryLength: 'short', language: 'English' });
//     console.log("Short Summary:", shortSummary);
//
//     const bulletSummary = await summarizeText(sampleText, { summaryLength: 'bullets' });
//     console.log("Bullet Summary:", bulletSummary);
//   } catch (error) {
//     console.error("Summarization test failed:", error);
//   }
// }
//
// testSummarization(); // Call this from a context where chrome.storage and chrome.runtime are available.
