// your-ai-copilot/js/core/keywordExtractor.js

const { callLLMProvider } = require('./llmUtils.js');

/**
 * @file keywordExtractor.js
 * Extracts keywords and key concepts from text using LLMs.
 */

/**
 * Extracts keywords from a given text.
 *
 * @param {string} textContent The text to extract keywords from.
 * @param {object} options Configuration options.
 * @param {string} [options.provider] - LLM provider.
 * @param {string} [options.model] - Specific LLM model.
 * @param {number} [options.numKeywords=10] - Approximate number of keywords to extract.
 * @param {string} [options.language='en'] - Language of the text.
 * @param {string} [options.outputFormat='list'] - Desired output: 'list' (array of strings) or 'json_mindmap' (structured JSON for mind map).
 * @param {string} [options.customPrompt] - Custom prompt template.
 * @returns {Promise<Array<string>|object>} A promise that resolves to an array of keywords (strings) or a JSON object for mind maps.
 * @throws {Error} If keyword extraction fails or parsing is unsuccessful.
 */
async function extractKeywords(textContent, options = {}) {
    if (!textContent || typeof textContent !== 'string' || !textContent.trim()) {
        throw new Error("Text content for keyword extraction cannot be empty.");
    }

    const settings = await chrome.storage.local.get(['userSettings']);
    const effectiveProvider = options.provider || settings.userSettings?.defaultProvider || 'openai';

    const numKeywords = options.numKeywords || 10;
    const language = options.language || 'English';
    const outputFormat = options.outputFormat || 'list'; // 'list' or 'json_mindmap'

    let prompt;
    let systemPrompt = `You are an AI assistant specialized in extracting key information from text.
Analyze the provided text and identify the most important keywords, concepts, and entities.`;

    if (options.customPrompt) {
        prompt = options.customPrompt.replace(/\{\{text\}\}/gi, textContent)
                                     .replace(/\{\{num_keywords\}\}/gi, numKeywords.toString())
                                     .replace(/\{\{language\}\}/gi, language)
                                     .replace(/\{\{output_format\}\}/gi, outputFormat);
    } else {
        if (outputFormat === 'list') {
            prompt = `Analyze the following text in ${language} and extract approximately ${numKeywords} most important keywords and key phrases.
Present the result as a JSON array of strings. For example: ["keyword1", "phrase 2", "concept3"].
Ensure the JSON is well-formed and contains only the array of keywords.

Text to process:
---
${textContent}
---

JSON Output:`;
            systemPrompt += ` You MUST output the keywords as a valid JSON array of strings: ["keyword1", "keyword2", ...]. Do not include any explanatory text before or after the JSON array.`;
        } else if (outputFormat === 'json_mindmap') {
            prompt = `Analyze the following text in ${language} and extract the main topic and approximately ${numKeywords} related key concepts, entities, and sub-topics.
Structure this information as a JSON object suitable for a mind map. The JSON should have a central "topic" string, and a "nodes" array. Each node object in the array should have a "name" (string for the concept/keyword) and optionally a "children" array (for nested concepts, following the same node structure).
For example: {"topic": "Main Idea", "nodes": [{"name": "Concept A", "children": [{"name": "Sub-concept A1"}]}, {"name": "Keyword B"}]}.
Ensure the JSON is well-formed.

Text to process:
---
${textContent}
---

JSON Output:`;
            systemPrompt += ` You MUST output the result as a single, valid JSON object representing the mind map structure. Do not include any explanatory text before or after the JSON object.`;
        } else {
            throw new Error(`Unsupported output format: ${outputFormat}. Choose 'list' or 'json_mindmap'.`);
        }
    }

    const llmOptions = {
        model: options.model,
        max_tokens: options.max_tokens || (outputFormat === 'list' ? (20 * numKeywords) : (50 * numKeywords)), // Estimate
        temperature: 0.5,
        system_prompt: systemPrompt,
    };

    if (effectiveProvider === 'openai' && options.model && (options.model.includes('gpt-4') || options.model.includes('gpt-3.5-turbo-1106'))) {
        llmOptions.response_format = { type: "json_object" }; // Helps ensure JSON output
    }

    try {
        console.log(`Requesting keywords from ${effectiveProvider} (format: ${outputFormat}). Prompt (start): "${prompt.substring(0, 150)}..."`);
        const rawResponse = await callLLMProvider(effectiveProvider, prompt, llmOptions);

        // Attempt to parse the JSON response
        let result;
        try {
            const cleanedResponse = rawResponse.trim().replace(/^```json\s*|```$/g, '');
            result = JSON.parse(cleanedResponse);

            if (outputFormat === 'list') {
                if (!Array.isArray(result) || !result.every(item => typeof item === 'string')) {
                    console.error("Parsed response for keyword list is not an array of strings:", result);
                    throw new Error("LLM response was valid JSON but not an array of strings for keywords.");
                }
            } else if (outputFormat === 'json_mindmap') {
                if (typeof result !== 'object' || result === null || !result.topic || !Array.isArray(result.nodes)) {
                    console.error("Parsed response for mind map JSON has incorrect structure:", result);
                    throw new Error("LLM response was valid JSON but not in the expected mind map structure.");
                }
                // Further validation of mind map node structure could be added here.
            }
        } catch (parseError) {
            console.error(`Failed to parse LLM response as JSON for keyword extraction (format: ${outputFormat}):`, parseError);
            console.error("Raw response was:", rawResponse);
            throw new Error(`Failed to parse keywords from LLM response. Ensure LLM is configured for JSON output. Raw response snippet: ${rawResponse.substring(0, 300)}`);
        }

        return result;

    } catch (error) {
        console.error(`Error extracting keywords with ${effectiveProvider}:`, error);
        throw new Error(`Failed to extract keywords: ${error.message}`);
    }
}

// Example Usage (conceptual):
//
// async function testKeywordExtraction() {
//   const sampleText = "Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to the natural intelligence displayed by humans or animals. Leading AI textbooks define the field as the study of 'intelligent agents': any system that perceives its environment and takes actions that maximize its chance of achieving its goals.";
//   try {
//     // Assuming user settings are available
//     const keywordList = await extractKeywords(sampleText, { numKeywords: 5, outputFormat: 'list' });
//     console.log("Keyword List:", keywordList);
//
//     const mindmapData = await extractKeywords(sampleText, { numKeywords: 5, outputFormat: 'json_mindmap' });
//     console.log("Mind Map JSON:", JSON.stringify(mindmapData, null, 2));
//
//   } catch (error) {
//     console.error("Keyword extraction test failed:", error);
//   }
// }
//
// testKeywordExtraction(); // Call from a context with chrome.storage and chrome.runtime

module.exports = {
    extractKeywords,
};
