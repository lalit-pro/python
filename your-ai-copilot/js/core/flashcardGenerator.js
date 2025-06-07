// your-ai-copilot/js/core/flashcardGenerator.js

const { callLLMProvider } = require('./llmUtils.js');

/**
 * @file flashcardGenerator.js
 * Generates flashcards from text content, suitable for Anki (JSON format).
 */

/**
 * Generates flashcards from a given text.
 *
 * @param {string} textContent The text to generate flashcards from.
 * @param {object} options Configuration options.
 * @param {string} [options.provider] - LLM provider.
 * @param {string} [options.model] - Specific LLM model.
 * @param {number} [options.numFlashcards=10] - Approximate number of flashcards to generate.
 * @param {string} [options.language='en'] - Language of the text and flashcards.
 * @param {string} [options.customPrompt] - Custom prompt template.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of flashcard objects.
 * Each object should have 'front' (question) and 'back' (answer) keys.
 * @throws {Error} If flashcard generation fails or parsing is unsuccessful.
 */
async function generateFlashcards(textContent, options = {}) {
    if (!textContent || typeof textContent !== 'string' || !textContent.trim()) {
        throw new Error("Text content for flashcards cannot be empty.");
    }

    const settings = await chrome.storage.local.get(['userSettings']);
    const effectiveProvider = options.provider || settings.userSettings?.defaultProvider || 'openai';

    const numFlashcards = options.numFlashcards || 10;
    const language = options.language || 'English';

    let prompt;
    if (options.customPrompt) {
        prompt = options.customPrompt.replace(/\{\{text\}\}/gi, textContent)
                                     .replace(/\{\{num_flashcards\}\}/gi, numFlashcards.toString())
                                     .replace(/\{\{language\}\}/gi, language);
    } else {
        prompt = `Analyze the following text and generate approximately ${numFlashcards} flashcards from it.
Each flashcard should be in a Question/Answer format.
The language of the flashcards should be ${language}.
Present the flashcards as a JSON array, where each object has a "front" (question) key and a "back" (answer) key.
For example: [{"front": "What is the capital of France?", "back": "Paris"}, {"front": "Question 2?", "back": "Answer 2"}].
Ensure the JSON is well-formed and contains only the array of flashcards.

Text to process:
---
${textContent}
---

JSON Output:`;
    }

    const llmOptions = {
        model: options.model,
        // More tokens needed for generating multiple flashcards in JSON format
        max_tokens: options.max_tokens || (150 * numFlashcards), // Estimate, might need adjustment
        temperature: 0.6, // Slightly creative but still factual
        system_prompt: `You are an AI assistant specialized in creating educational flashcards from text.
You MUST output the flashcards in a valid JSON array format: [{"front": "question", "back": "answer"}, ...].
Do not include any explanatory text before or after the JSON array.`,
        // Some providers/models might benefit from specific JSON mode instructions if available
        // response_format: { type: "json_object" } // Example for OpenAI if using newer models/APIs that support it directly
    };

    // For OpenAI, if a model supporting JSON mode is explicitly set, try to use it.
    // This is a simplified check. A more robust solution would check compatibility.
    if (effectiveProvider === 'openai' && options.model && (options.model.includes('gpt-4') || options.model.includes('gpt-3.5-turbo-1106'))) {
        llmOptions.response_format = { type: "json_object" };
    }


    try {
        console.log(`Requesting flashcards from ${effectiveProvider}. Prompt (start): "${prompt.substring(0, 200)}..."`);
        const rawResponse = await callLLMProvider(effectiveProvider, prompt, llmOptions);

        // Attempt to parse the JSON response
        let flashcards = [];
        try {
            // LLMs might sometimes include markdown backticks around JSON or other text.
            const cleanedResponse = rawResponse.trim().replace(/^```json\s*|```$/g, '');
            flashcards = JSON.parse(cleanedResponse);

            if (!Array.isArray(flashcards)) {
                console.error("Parsed response is not an array:", flashcards);
                throw new Error("LLM response was valid JSON but not an array of flashcards.");
            }
            // Validate structure of each flashcard
            if (flashcards.some(fc => typeof fc.front !== 'string' || typeof fc.back !== 'string')) {
                 console.error("Some flashcards have incorrect structure:", flashcards.filter(fc => typeof fc.front !== 'string' || typeof fc.back !== 'string'));
                 throw new Error("Some generated flashcards do not have the required 'front' and 'back' string properties.");
            }

        } catch (parseError) {
            console.error("Failed to parse LLM response as JSON for flashcards:", parseError);
            console.error("Raw response was:", rawResponse);
            // Attempt a more lenient extraction if strict parsing fails
            // This is a fallback and might not always work.
            const extracted = extractJsonArrayFromString(rawResponse);
            if (extracted && extracted.length > 0 && extracted.every(fc => fc.front && fc.back)) {
                console.warn("Lenient JSON extraction succeeded after strict parsing failed.");
                flashcards = extracted;
            } else {
                throw new Error(`Failed to parse flashcards from LLM response. Ensure the LLM is configured to output valid JSON. Raw response snippet: ${rawResponse.substring(0, 300)}`);
            }
        }

        return flashcards;

    } catch (error) {
        console.error(`Error generating flashcards with ${effectiveProvider}:`, error);
        throw new Error(`Failed to generate flashcards: ${error.message}`);
    }
}

/**
 * Tries to extract a JSON array from a string that might contain other text.
 * @param {string} str The string to search within.
 * @returns {Array|null} The extracted array or null if not found.
 */
function extractJsonArrayFromString(str) {
    // Match JSON array structure (simplified regex, might need refinement)
    const match = str.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (match && match[0]) {
        try {
            return JSON.parse(match[0]);
        } catch (e) {
            console.warn("Lenient extraction: Found array-like structure but failed to parse:", e);
            return null;
        }
    }
    return null;
}


/**
 * Formats an array of flashcard objects into AnkiConnect import format (JSON).
 * AnkiConnect expects an "action": "addNotes" with "notes" array.
 * Each note has "deckName", "modelName", "fields", "tags".
 *
 * @param {Array<object>} flashcards Array of {front: string, back: string}.
 * @param {string} deckName Desired Anki deck name.
 * @param {string} modelName Anki note type (e.g., "Basic").
 * @param {Array<string>} [tags=[]] Optional tags for the notes.
 * @returns {object} JSON object for AnkiConnect batch import.
 */
function formatForAnki(flashcards, deckName = "YourAI Copilot Deck", modelName = "Basic", tags = ["YourAICopilot"]) {
    if (!Array.isArray(flashcards) || flashcards.length === 0) {
        return null;
    }

    const notes = flashcards.map(card => ({
        deckName: deckName,
        modelName: modelName, // Assumes a "Basic" model with "Front" and "Back" fields
        fields: {
            "Front": card.front,
            "Back": card.back
        },
        tags: tags
    }));

    return {
        action: "addNotes",
        version: 6,
        params: {
            notes: notes
        }
    };
}


// Example Usage (conceptual):
//
// async function testFlashcardGeneration() {
//   const sampleText = "The mitochondria is the powerhouse of the cell. It generates most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy. The process is called cellular respiration.";
//   try {
//     const cards = await generateFlashcards(sampleText, { numFlashcards: 3 });
//     console.log("Generated Flashcards:", cards);
//
//     if (cards && cards.length > 0) {
//       const ankiJson = formatForAnki(cards, "Biology 101", "Basic (and reversed card)");
//       console.log("Anki JSON for import:", JSON.stringify(ankiJson, null, 2));
//       // To use with AnkiConnect, this JSON would be POSTed to http://localhost:8765
//     }
//
//   } catch (error) {
//     console.error("Flashcard generation test failed:", error);
//   }
// }
//
// testFlashcardGeneration(); // Call from a context with chrome.storage and chrome.runtime

module.exports = {
    generateFlashcards,
    formatForAnki,
};
