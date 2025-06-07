// your-ai-copilot/tests/unit/core/qaAgent.test.js

import { askQuestion } from '../../../js/core/qaAgent.js';
// Mock llmUtils.js
jest.mock('../../../js/core/llmUtils.js', () => ({
  callLLMProvider: jest.fn(),
}));
import { callLLMProvider } from '../../../js/core/llmUtils.js'; // Import the mocked function

describe('qaAgent.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      const result = { userSettings: { defaultProvider: 'openai' } };
      if (typeof callback === 'function') {
        callback(result);
        return undefined;
      }
      return Promise.resolve(result);
    });
  });

  it('should throw an error if question is empty or invalid', async () => {
    await expect(askQuestion('')).rejects.toThrow("Question cannot be empty.");
    await expect(askQuestion(null)).rejects.toThrow("Question cannot be empty.");
  });

  it('should call callLLMProvider with question and default options', async () => {
    callLLMProvider.mockResolvedValue("AI answer.");
    const question = "What is AI?";
    await askQuestion(question);

    expect(callLLMProvider).toHaveBeenCalledTimes(1);
    expect(callLLMProvider).toHaveBeenCalledWith(
      'openai', // Default provider
      question, // The question itself is the prompt for basic case
      expect.objectContaining({
        max_tokens: 700,
        temperature: 0.7,
        system_prompt: expect.stringContaining("You are a helpful AI assistant"),
      })
    );
  });

  it('should include pageText in the prompt if provided (OpenAI/Anthropic)', async () => {
    callLLMProvider.mockResolvedValue("Contextual answer.");
    const question = "What is mentioned about dogs?";
    const pageText = "Cats are nice. Dogs are loyal.";
    // For OpenAI/Anthropic, the qaAgent modifies the `constructOptions.messages`
    // and `finalPromptForLLMUtil` becomes the last user message content.
    await askQuestion(question, { pageText, provider: 'openai' });

    const expectedUserContent = `Based on the following context if relevant:\n\n---\n${pageText.substring(0, 2000)}...\n---\n\nMy question is: ${question}`;

    expect(callLLMProvider).toHaveBeenCalledWith(
      'openai',
      expectedUserContent, // This is the content of the last message
      expect.objectContaining({
        messages: [
          { role: 'user', content: expectedUserContent }
        ],
        system_prompt: expect.stringContaining("Prioritize information from the provided page text"),
      })
    );
  });

  it('should include pageText in the prompt for Gemini', async () => {
    callLLMProvider.mockResolvedValue("Gemini contextual answer.");
    const question = "What about dogs?";
    const pageText = "Cats are nice. Dogs are loyal.";
    await askQuestion(question, { pageText, provider: 'gemini' });

    const expectedGeminiPrompt = `Context from page:\n${pageText.substring(0,2000)}...\n\nQuestion: ${question}`;
    expect(callLLMProvider).toHaveBeenCalledWith(
      'gemini',
      expectedGeminiPrompt, // Gemini gets a single combined prompt string
      expect.any(Object)
    );
  });

  it('should incorporate chatHistory for OpenAI/Anthropic', async () => {
    callLLMProvider.mockResolvedValue("Follow-up answer.");
    const question = "Why are they loyal?";
    const pageText = "Dogs are loyal.";
    const chatHistory = [
      { role: 'user', content: "What about dogs?" },
      { role: 'assistant', content: "Dogs are loyal." }
    ];
    await askQuestion(question, { pageText, chatHistory, provider: 'anthropic' });

    const expectedUserContent = `Based on the following context if relevant:\n\n---\n${pageText.substring(0, 2000)}...\n---\n\nMy question is: ${question}`;

    expect(callLLMProvider).toHaveBeenCalledWith(
      'anthropic',
      expectedUserContent,
      expect.objectContaining({
        messages: [
          ...chatHistory,
          { role: 'user', content: expectedUserContent }
        ]
      })
    );
  });

  it('should use customSystemPrompt if provided', async () => {
    callLLMProvider.mockResolvedValue("Answer from custom agent.");
    const question = "Tell me a joke.";
    const customSystemPrompt = "You are a comedian AI.";
    await askQuestion(question, { customSystemPrompt });

    expect(callLLMProvider).toHaveBeenCalledWith(
      'openai',
      question,
      expect.objectContaining({ system_prompt: customSystemPrompt })
    );
  });

  it('should return the answer from callLLMProvider', async () => {
    const expectedAnswer = "This is the AI's response.";
    callLLMProvider.mockResolvedValue(expectedAnswer);
    const answer = await askQuestion("A question?");
    expect(answer).toBe(expectedAnswer);
  });

  it('should throw an error if callLLMProvider fails', async () => {
    callLLMProvider.mockRejectedValue(new Error("LLM connection failed"));
    await expect(askQuestion("Will this fail?")).rejects.toThrow("Failed to get answer: LLM connection failed");
  });
});
