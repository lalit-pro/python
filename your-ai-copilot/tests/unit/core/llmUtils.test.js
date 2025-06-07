// your-ai-copilot/tests/unit/core/llmUtils.test.js

// Manually mock chrome APIs if not using a global setup file or if needing specific overrides
// jest.mock('../../../js/background/background', () => ({ // If it were a direct import
//   callLLM: jest.fn(),
// }));
// Since llmUtils uses chrome.runtime.sendMessage, ensure global.chrome is mocked.
// The jest.setup.js should handle this.

// Import the functions to be tested
// Adjust the path based on your actual file structure and Jest config (moduleNameMapper)
// This path assumes jest.config.js maps '../js/core/' correctly or that relative paths work.
// Let's try a relative path from the test file's location.
import { constructLLMRequestBody, parseLLMResponse, callLLMProvider } from '../../../js/core/llmUtils.js';

describe('llmUtils', () => {
  // Reset mocks before each test if they are modified within tests
  beforeEach(() => {
    jest.clearAllMocks(); // Clears call counts, etc.

    // Provide a default mock for chrome.runtime.sendMessage for these tests if needed
    global.chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'callLLM') {
        // Simulate a successful LLM API call from background
        const responsePayload = {
          openai: { choices: [{ message: { content: "OpenAI mock response" } }] },
          anthropic: { content: [{ text: "Anthropic mock response" }] },
          gemini: { candidates: [{ content: { parts: [{ text: "Gemini mock response" }] } }] },
        };
        const data = responsePayload[message.data.provider] || { text: "Unknown provider mock response" };
        if (callback) callback({ success: true, data: data });
        return Promise.resolve({ success: true, data: data });
      }
      if (callback) callback({ success: false, error: 'Unhandled mock action' });
      return Promise.resolve({ success: false, error: 'Unhandled mock action' });
    });
  });

  describe('constructLLMRequestBody', () => {
    it('should construct correct body for OpenAI', () => {
      const body = constructLLMRequestBody('openai', 'Test prompt', { model: 'gpt-test', max_tokens: 100, system_prompt: 'System OpenAI' });
      expect(body.model).toBe('gpt-test');
      expect(body.messages).toEqual(expect.arrayContaining([
        { role: 'system', content: 'System OpenAI' },
        { role: 'user', content: 'Test prompt' }
      ]));
      expect(body.max_tokens).toBe(100);
    });

    it('should construct correct body for Anthropic', () => {
      const body = constructLLMRequestBody('anthropic', 'Test prompt', { model: 'claude-test', system_prompt: 'System Anthropic' });
      expect(body.model).toBe('claude-test');
      expect(body.messages).toEqual([{ role: 'user', content: 'Test prompt' }]);
      expect(body.system).toBe('System Anthropic');
    });

    it('should construct correct body for Gemini', () => {
      const body = constructLLMRequestBody('gemini', 'Test prompt Gemini', { system_prompt: 'System Gemini' });
      // Note: system_prompt for Gemini is handled by prepending in the current llmUtils implementation
      expect(body.contents[0].parts[0].text).toBe('Test prompt Gemini'); // System prompt is prepended by default if strategy is that
      expect(body.generationConfig.maxOutputTokens).toBeDefined();
    });

    it('should throw error for unsupported provider', () => {
      expect(() => constructLLMRequestBody('unsupported', 'Test')).toThrow('Unsupported LLM provider: unsupported');
    });
  });

  describe('parseLLMResponse', () => {
    it('should parse OpenAI response', () => {
      const response = { choices: [{ message: { content: " Parsed OpenAI " } }] };
      expect(parseLLMResponse('openai', response)).toBe("Parsed OpenAI");
    });

    it('should parse Anthropic response', () => {
      const response = { content: [{ text: " Parsed Anthropic " }] };
      expect(parseLLMResponse('anthropic', response)).toBe("Parsed Anthropic");
    });

    it('should parse Gemini response', () => {
      const response = { candidates: [{ content: { parts: [{ text: " Parsed Gemini " }] } }] };
      expect(parseLLMResponse('gemini', response)).toBe("Parsed Gemini");
    });

    it('should handle Gemini safety block response', () => {
        const response = { promptFeedback: { blockReason: "SAFETY" }};
        expect(parseLLMResponse('gemini', response)).toContain("Error: Request blocked by API. Reason: SAFETY");
    });

    it('should return error message for unparseable or unexpected structure', () => {
        expect(parseLLMResponse('openai', {})).toContain("Error: Could not parse LLM response.");
        expect(parseLLMResponse('anthropic', { foo: 'bar' })).toContain("Error: Could not parse LLM response.");
        expect(parseLLMResponse('gemini', { bar: 'foo' })).toContain("Error: Could not parse LLM response.");
    });
  });

  describe('callLLMProvider', () => {
    it('should call sendMessage and parse response for OpenAI', async () => {
      const result = await callLLMProvider('openai', 'Hello OpenAI');
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
      // Check some part of the message data if needed
      expect(chrome.runtime.sendMessage.mock.calls[0][0].data.provider).toBe('openai');
      expect(result).toBe('OpenAI mock response');
    });

    it('should call sendMessage and parse response for Anthropic', async () => {
      const result = await callLLMProvider('anthropic', 'Hello Anthropic');
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
      expect(result).toBe('Anthropic mock response');
    });

    it('should handle error from sendMessage', async () => {
      chrome.runtime.sendMessage.mockImplementationOnce((message, callback) => {
        if (callback) callback({ success: false, error: 'Test API error' });
        return Promise.resolve({ success: false, error: 'Test API error' });
      });
      await expect(callLLMProvider('openai', 'Test error')).rejects.toThrow('LLM call failed: Test API error');
    });
  });
});
