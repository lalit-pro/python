// your-ai-copilot/tests/unit/core/summarizer.test.js

import { summarizeText } from '../../../js/core/summarizer.js';
// Mock llmUtils.js since summarizeText depends on callLLMProvider from it
jest.mock('../../../js/core/llmUtils.js', () => ({
  callLLMProvider: jest.fn(),
}));
// llmUtils.js is now mocked. We can control its behavior for each test.
import { callLLMProvider } from '../../../js/core/llmUtils.js'; // Import the mocked function

describe('summarizer.js', () => {
  beforeEach(() => {
    // Clear mock calls and reset any customized mock behavior before each test
    jest.clearAllMocks();

    // Reset global chrome API mocks if they are modified by specific tests (though less likely here)
    // For chrome.storage.local.get, provide a default mock implementation for userSettings
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      const result = {};
      if (keys === 'userSettings' || (Array.isArray(keys) && keys.includes('userSettings'))) {
        result.userSettings = { defaultProvider: 'openai', selectedLanguage: 'en' };
      }
      // Other keys can be added here if needed for other tests
      if (typeof callback === 'function') {
        callback(result);
        return undefined; // Mimic callback style if necessary for some tests
      }
      return Promise.resolve(result);
    });
  });

  it('should throw an error if textToSummarize is empty or invalid', async () => {
    await expect(summarizeText('')).rejects.toThrow("Text to summarize cannot be empty.");
    await expect(summarizeText(null)).rejects.toThrow("Text to summarize cannot be empty.");
    await expect(summarizeText(undefined)).rejects.toThrow("Text to summarize cannot be empty.");
    await expect(summarizeText('   ')).rejects.toThrow("Text to summarize cannot be empty.");
  });

  it('should call callLLMProvider with correct default parameters', async () => {
    callLLMProvider.mockResolvedValue("Mocked summary."); // Mock the response from LLM
    const text = "This is a long text to summarize.";
    await summarizeText(text);

    expect(callLLMProvider).toHaveBeenCalledTimes(1);
    expect(callLLMProvider).toHaveBeenCalledWith(
      'openai', // Default provider from mocked userSettings
      expect.stringContaining(text), // Prompt should contain the text
      expect.objectContaining({
        max_tokens: 200, // Default for 'medium' length
        temperature: 0.5,
        system_prompt: expect.stringContaining("You are an expert summarization assistant."),
      })
    );
  });

  it('should use options.provider if specified', async () => {
    callLLMProvider.mockResolvedValue("Anthropic summary.");
    const text = "Summarize this with Anthropic.";
    await summarizeText(text, { provider: 'anthropic' });

    expect(callLLMProvider).toHaveBeenCalledWith(
      'anthropic',
      expect.any(String),
      expect.any(Object)
    );
  });

  it('should construct prompt based on summaryLength and language', async () => {
    callLLMProvider.mockResolvedValue("Short summary in German.");
    const text = "A text for a short German summary.";
    await summarizeText(text, { summaryLength: 'short', language: 'German' });

    expect(callLLMProvider).toHaveBeenCalledWith(
      'openai',
      expect.stringContaining("Please provide a very short summary (1-2 sentences) of the following text in German:"),
      expect.objectContaining({ max_tokens: 100 }) // max_tokens for 'short'
    );

    callLLMProvider.mockClear();
    await summarizeText(text, { summaryLength: 'bullets' });
     expect(callLLMProvider).toHaveBeenCalledWith(
      'openai',
      expect.stringContaining("Please provide a summary in bullet points of the following text:"),
      expect.objectContaining({ max_tokens: 300 }) // max_tokens for 'bullets'
    );
  });

  it('should use customPrompt if provided', async () => {
    callLLMProvider.mockResolvedValue("Custom summary response.");
    const text = "Some text.";
    const customPrompt = "My custom instruction: {{text}} in {{language}}.";
    await summarizeText(text, { customPrompt, language: 'Spanish' });

    expect(callLLMProvider).toHaveBeenCalledWith(
      'openai',
      "My custom instruction: Some text. in Spanish.", // Expected filled prompt
      expect.any(Object)
    );
  });

  it('should return the summary from callLLMProvider', async () => {
    const expectedSummary = "This is the final summary from the LLM.";
    callLLMProvider.mockResolvedValue(expectedSummary);
    const text = "Text to be summarized.";
    const summary = await summarizeText(text);
    expect(summary).toBe(expectedSummary);
  });

  it('should throw an error if callLLMProvider fails', async () => {
    callLLMProvider.mockRejectedValue(new Error("LLM API Error"));
    const text = "This will fail.";
    await expect(summarizeText(text)).rejects.toThrow("Failed to summarize text: LLM API Error");
  });

  it('should use default provider from storage if options.provider is not set', async () => {
    global.chrome.storage.local.get.mockResolvedValue({
        userSettings: { defaultProvider: 'gemini', selectedLanguage: 'fr' }
    });
    callLLMProvider.mockResolvedValue("Gemini summary.");
    const text = "Summarize this with default Gemini.";
    await summarizeText(text);

    expect(callLLMProvider).toHaveBeenCalledWith(
      'gemini',
      expect.any(String),
      expect.any(Object)
    );
  });

  it('should handle missing userSettings gracefully and use hardcoded default provider', async () => {
    global.chrome.storage.local.get.mockResolvedValue({}); // Simulate no userSettings in storage
    callLLMProvider.mockResolvedValue("Fallback provider summary.");
    const text = "Summarize with no stored settings.";
    await summarizeText(text);

    expect(callLLMProvider).toHaveBeenCalledWith(
      'openai', // Hardcoded default if no settings found
      expect.any(String),
      expect.any(Object)
    );
  });

});

// Conceptual test for summarizeUrl (it's expected to throw as not implemented)
describe('summarizer.js - summarizeUrl (conceptual)', () => {
    it('summarizeUrl should throw an error as it is not implemented', async () => {
        // Import it specifically for this test if it's not already.
        const { summarizeUrl } = require('../../../js/core/summarizer.js');
        await expect(summarizeUrl('http://example.com', {}))
            .rejects
            .toThrow("summarizeUrl requires page content fetching capability, which is not implemented in this standalone module example. Use summarizeText with fetched content.");
    });
});
