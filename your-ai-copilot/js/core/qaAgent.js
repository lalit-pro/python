// your-ai-copilot/js/core/qaAgent.js

import { callLLMProvider } from './llmUtils.js';

/**
 * @file qaAgent.js
 * Handles Question & Answer interactions, potentially maintaining context.
 */

/**
 * Asks a question to an LLM, potentially with context from page content or previous conversation.
 *
 * @param {string} question The user's question.
 * @param {object} options Configuration options for the Q&A.
 * @param {string} [options.provider] - Specific LLM provider. Defaults to user's setting.
 * @param {string} [options.model] - Specific model to use.
 * @param {string} [options.pageText] - Text content from the current web page to use as context.
 * @param {Array<object>} [options.chatHistory] - Previous messages in the conversation, e.g., [{role: 'user', content: '...'}, {role: 'assistant', content: '...'}].
 * @param {string} [options.language='en'] - Language for the interaction.
 * @param {string} [options.customSystemPrompt] - A custom system prompt for the Q&A agent.
 * @returns {Promise<string>} A promise that resolves to the LLM's answer.
 * @throws {Error} If the Q&A process fails.
 */
export async function askQuestion(question, options = {}) {
    if (!question || typeof question !== 'string' || !question.trim()) {
        throw new Error("Question cannot be empty.");
    }

    const settings = await chrome.storage.local.get(['userSettings']);
    const effectiveProvider = options.provider || settings.userSettings?.defaultProvider || 'openai';

    let systemPrompt = options.customSystemPrompt || "You are a helpful AI assistant designed to answer questions based on provided context or general knowledge. Be concise and accurate.";
    if (options.pageText) {
        systemPrompt += " Prioritize information from the provided page text if relevant to the question.";
    }

    // Construct the main prompt or messages array
    let promptMessages = [];
    let llmPrompt; // For single-prompt providers if not using messages array directly

    // For OpenAI and Anthropic, 'messages' array is preferred for context/history
    if (effectiveProvider === 'openai' || effectiveProvider === 'anthropic') {
        if (options.chatHistory && options.chatHistory.length > 0) {
            promptMessages.push(...options.chatHistory);
        }
        // Add current page context if provided and not already in history in a similar way
        if (options.pageText) {
            // Simple way to add page context: prepend it to the latest question or as a separate user message.
            // A more sophisticated approach might involve a dedicated context message or a specific format.
            // For now, let's assume the system prompt guides the LLM to use it.
            // Or, we can inject it into the user's question.
             promptMessages.push({ role: "user", content: `Based on the following context if relevant:

---
${options.pageText.substring(0, 2000)}...
---

My question is: ${question}` });
        } else {
            promptMessages.push({ role: "user", content: question });
        }
    } else if (effectiveProvider === 'gemini') {
        // Gemini uses a 'contents' array with 'parts'. History needs to be formatted accordingly.
        // For a simple Q&A, the question (optionally prefixed with context) is the main part.
        let geminiFullPrompt = question;
        if (options.pageText) {
            geminiFullPrompt = `Context from page:
${options.pageText.substring(0, 2000)}...

Question: ${question}`;
        }
        // TODO: Gemini history construction if options.chatHistory is provided.
        // This would involve mapping roles to 'user'/'model' and structuring 'contents'.
        llmPrompt = geminiFullPrompt; // Will be used by constructLLMRequestBody
    } else {
         // Fallback for other potential providers or simple setup
        llmPrompt = question;
        if (options.pageText) {
            llmPrompt = `Context:
${options.pageText.substring(0,2000)}...

Question: ${question}`;
        }
    }


    const llmOptions = {
        model: options.model,
        max_tokens: options.max_tokens || 700, // More tokens for potentially detailed answers
        temperature: options.temperature || 0.7,
        system_prompt: systemPrompt, // Passed to constructLLMRequestBody
        // For OpenAI/Anthropic, `messages` will be constructed by constructLLMRequestBody if `llmPrompt` is used.
        // If `promptMessages` is built here, it should be passed in a way that constructLLMRequestBody understands.
        // Let's refine constructLLMRequestBody to accept a messages array directly.
    };

    // Modify constructLLMRequestBody to accept pre-formed messages for OpenAI/Anthropic.
    // For now, we'll adapt here.
    let finalPromptForLLMUtil;
    let constructOptions = {...llmOptions};

    if ((effectiveProvider === 'openai' || effectiveProvider === 'anthropic') && promptMessages.length > 0) {
        // If we already built the messages array, pass it directly
        // This requires llmUtils.constructLLMRequestBody to handle an 'messages' option.
        // Let's assume llmUtils.constructLLMRequestBody will use options.messages if provided for these providers.
        constructOptions.messages = promptMessages;
        finalPromptForLLMUtil = promptMessages[promptMessages.length-1].content; // Main query for logging or simple case
    } else {
        finalPromptForLLMUtil = llmPrompt || question; // For Gemini or if messages array wasn't built
    }


    try {
        console.log(`Asking question to ${effectiveProvider}: "${finalPromptForLLMUtil.substring(0,100)}..."`);
        const answer = await callLLMProvider(effectiveProvider, finalPromptForLLMUtil, constructOptions);
        return answer;
    } catch (error) {
        console.error(`Error during Q&A with ${effectiveProvider}:`, error);
        throw new Error(`Failed to get answer: ${error.message}`);
    }
}

// Example Usage (conceptual):
//
// async function testQA() {
//   const pageContext = "Photosynthesis is a process used by plants, algae, and certain bacteria to harness energy from sunlight and turn it into chemical energy. This process is vital for life on Earth as it produces oxygen and is the foundation of most food chains.";
//   const userQuestion = "What is photosynthesis and why is it important?";
//
//   try {
//     // Assume user settings are available
//     const answer = await askQuestion(userQuestion, { pageText: pageContext });
//     console.log("Answer from AI:", answer);
//
//     // Follow-up question (conceptual history management)
//     const followUpQuestion = "Which organisms perform it?";
//     const chatHistory = [
//       { role: 'user', content: userQuestion },
//       { role: 'assistant', content: answer },
//     ];
//     const followUpAnswer = await askQuestion(followUpQuestion, { pageText: pageContext, chatHistory: chatHistory });
//     console.log("Follow-up Answer:", followUpAnswer);
//
//   } catch (error) {
//     console.error("Q&A test failed:", error);
//   }
// }
//
// testQA(); // Call from a context with chrome.storage and chrome.runtime
