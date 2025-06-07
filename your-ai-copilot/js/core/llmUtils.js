// your-ai-copilot/js/core/llmUtils.js

/**
 * @file llmUtils.js
 * Utilities for interacting with Large Language Models (LLMs).
 * This module standardizes requests and responses for different providers.
 */

// Note: Actual API calls are made via chrome.runtime.sendMessage to the background script's 'callLLM' action.
// This module focuses on constructing request bodies and parsing responses.

/**
 * Constructs the request body for a given LLM provider and task.
 * @param {string} provider - 'openai', 'anthropic', or 'gemini'.
 * @param {string} prompt - The main prompt or user message.
 * @param {object} options - Task-specific options (e.g., model, max_tokens, system_prompt, context).
 * @returns {object} The request body suitable for the provider.
 * @throws {Error} if provider is not supported.
 */
export function constructLLMRequestBody(provider, prompt, options = {}) {
    const {
        model, // Specific model name
        max_tokens = 500, // Default max tokens
        temperature = 0.7, // Default temperature
        system_prompt = "You are a helpful AI assistant.", // Default system prompt
        context = "", // Additional context (e.g., page text, previous messages)
        role = "user" // Role of the primary prompt message
    } = options;

    let fullPrompt = prompt;
    if (context) {
        fullPrompt = `Context:
${context}

User Query:
${prompt}`;
    }

    switch (provider) {
        case 'openai':
            return {
                model: model || 'gpt-3.5-turbo', // Default OpenAI model
                messages: [
                    ...(system_prompt && provider !== 'gemini' ? [{ role: "system", content: system_prompt }] : []), // Gemini handles system prompts differently or not at all in basic API
                    { role: role, content: fullPrompt }
                ],
                max_tokens: max_tokens,
                temperature: temperature,
            };
        case 'anthropic':
            return {
                model: model || 'claude-3-haiku-20240307', // Default Anthropic model
                messages: [{ role: role, content: fullPrompt }],
                system: system_prompt, // Anthropic has a dedicated system prompt field
                max_tokens: max_tokens,
                temperature: temperature,
            };
        case 'gemini':
            // Gemini's structure is different (contents, parts)
            // System prompt might be part of the initial 'contents' or managed via specific configurations.
            // For simplicity, we'll include it as a prefix if provided.
            const geminiPromptParts = [];
            if (system_prompt) {
                 // Gemini prefers system instructions within the user prompt or through multi-turn conversation setup
                 // For a single call, prepending it to the user's prompt is a common way.
                 // geminiPromptParts.push({ text: `System Instruction: ${system_prompt}` });
            }
            geminiPromptParts.push({ text: fullPrompt });

            return {
                // Model is often part of the endpoint for Gemini, not the body for 'generateContent'
                // If using specific model methods, this might change.
                contents: [{ role: role, parts: geminiPromptParts }], // Role can be 'user' or 'model'
                generationConfig: {
                    maxOutputTokens: max_tokens,
                    temperature: temperature,
                },
                // safetySettings can be added here if needed
            };
        default:
            console.error(`Unsupported LLM provider: ${provider}`);
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}

/**
 * Parses the response from an LLM provider to extract the main text content.
 * @param {string} provider - 'openai', 'anthropic', or 'gemini'.
 * @param {object} responseData - The raw JSON response data from the LLM API.
 * @returns {string} The extracted text content.
 * @throws {Error} if provider is not supported or response format is unexpected.
 */
export function parseLLMResponse(provider, responseData) {
    if (!responseData) {
        console.error("Received null or undefined responseData for parsing.");
        return "Error: No response data received from LLM.";
    }

    try {
        switch (provider) {
            case 'openai':
                if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
                    return responseData.choices[0].message.content.trim();
                }
                break;
            case 'anthropic':
                if (responseData.content && responseData.content[0] && responseData.content[0].text) {
                    return responseData.content[0].text.trim();
                }
                // Support for older Anthropic stream format or error messages
                if (responseData.completion) {
                    return responseData.completion.trim();
                }
                break;
            case 'gemini':
                if (responseData.candidates && responseData.candidates[0] &&
                    responseData.candidates[0].content && responseData.candidates[0].content.parts &&
                    responseData.candidates[0].content.parts[0] && responseData.candidates[0].content.parts[0].text) {
                    return responseData.candidates[0].content.parts[0].text.trim();
                }
                // Check for prompt feedback if no candidates (e.g. safety block)
                if (responseData.promptFeedback && responseData.promptFeedback.blockReason) {
                    return `Error: Request blocked by API. Reason: ${responseData.promptFeedback.blockReason}. ${responseData.promptFeedback.safetyRatings ? JSON.stringify(responseData.promptFeedback.safetyRatings) : ''}`;
                }
                break;
            default:
                console.error(`Unsupported LLM provider for parsing: ${provider}`);
                throw new Error(`Unsupported LLM provider for parsing: ${provider}`);
        }
        // If specific parsing fails, try to find a general text field or stringify
        console.warn(`Could not find standard text content for ${provider}. Response structure might have changed. Data:`, responseData);
        if (typeof responseData === 'string') return responseData; // Already parsed?
        if (responseData.text) return responseData.text;
        if (responseData.message) return responseData.message;
        return "Error: Could not parse LLM response. Structure unexpected.";

    } catch (error) {
        console.error(`Error parsing LLM response for ${provider}:`, error, "Data:", responseData);
        return `Error: Exception during LLM response parsing - ${error.message}`;
    }
}

/**
 * A wrapper function to call an LLM via the background script.
 * @param {string} provider The LLM provider ('openai', 'anthropic', 'gemini').
 * @param {string} prompt The user's prompt.
 * @param {object} options Additional options for constructLLMRequestBody and API call.
 *                         Includes `model`, `max_tokens`, `temperature`, `system_prompt`, `context`.
 *                         Also `apiKey` if direct override is needed (generally not recommended here).
 * @returns {Promise<string>} The parsed text response from the LLM.
 * @throws {Error} If API call fails or response parsing fails.
 */
export async function callLLMProvider(provider, prompt, options = {}) {
    const { apiKey, ...constructOptions } = options; // Separate apiKey if passed
    const requestBody = constructLLMRequestBody(provider, prompt, constructOptions);

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'callLLM',
            data: {
                provider,
                body: requestBody,
                apiKey: apiKey // Pass apiKey if provided, background will use stored one otherwise
            }
        });

        if (response && response.success) {
            return parseLLMResponse(provider, response.data);
        } else {
            const errorMessage = response ? response.error : "No response from background script.";
            console.error(`LLM call failed via background: ${errorMessage}`, response);
            throw new Error(`LLM call failed: ${errorMessage}`);
        }
    } catch (error) {
        console.error(`Error in callLLMProvider (${provider}):`, error);
        // Rethrow with a more specific message if possible, or the original error
        throw error instanceof Error ? error : new Error(String(error));
    }
}

// Example Usage (conceptual, actual calls would be from other core modules):
//
// import { callLLMProvider } from './llmUtils.js';
//
// async function getSummary(textToSummarize) {
//   try {
//     const settings = await chrome.storage.local.get(['userSettings']);
//     const provider = settings.userSettings?.defaultProvider || 'openai';
//     const prompt = `Please summarize the following text:

${textToSummarize}`;
//     const options = {
//       max_tokens: 150,
//       system_prompt: "You are an expert summarizer.",
//       // model: 'gpt-4' // Optionally specify a model
//     };
//     const summary = await callLLMProvider(provider, prompt, options);
//     console.log(`Summary from ${provider}:`, summary);
//     return summary;
//   } catch (error) {
//     console.error("Failed to get summary:", error);
//     throw error;
//   }
// }
