// your-ai-copilot/tests/unit/jest.setup.js

// Global mocks for Chrome APIs can go here if needed for many tests
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        // Default mock behavior: return empty object or specific mock data
        if (typeof callback === 'function') {
          callback({});
        }
        return Promise.resolve({});
      }),
      set: jest.fn((items, callback) => {
        if (typeof callback === 'function') {
          callback();
        }
        return Promise.resolve();
      }),
      remove: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    },
    sync: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
      // ... other sync methods
    },
    // ... other chrome.storage areas like 'managed'
  },
  runtime: {
    sendMessage: jest.fn((message, callback) => {
      // Default mock: simulate successful response or specific test case response
      if (callback) callback({ success: true, data: 'mocked response' });
      return Promise.resolve({ success: true, data: 'mocked response' });
    }),
    getManifest: jest.fn(() => ({ version: '1.0.0', manifest_version: 3 })),
    getURL: jest.fn(path => `chrome-extension://mock_id/${path}`),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    // ... other runtime APIs
  },
  alarms: {
    create: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    getAll: jest.fn().mockResolvedValue([]),
    clear: jest.fn().mockResolvedValue(true),
    onAlarm: {
      addListener: jest.fn(),
    },
  },
  notifications: {
      create: jest.fn()
  },
  scripting: {
      executeScript: jest.fn().mockResolvedValue([{ result: null }])
  },
  tabs: {
      query: jest.fn().mockResolvedValue([{ id: 1, url: 'http://example.com' }])
  },
  contextMenus: {
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      onClicked: {
          addListener: jest.fn()
      }
  },
  permissions: {
      getAll: jest.fn().mockResolvedValue({ origins: [], permissions: []}),
      request: jest.fn().mockResolvedValue(true),
      remove: jest.fn().mockResolvedValue(true),
  }
  // Add other Chrome APIs as needed by the modules under test
};

// Mock for fetch if your utils directly use it (though they shouldn't for API keys)
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ mockedData: true }),
    text: () => Promise.resolve("mocked text response")
  })
);

// If your modules use `export` and `import` and you haven't set up Babel for Jest:
// Jest's default environment (jsdom or node) might not understand ES Modules syntax in .js files.
// The simplest way for this project, given its scale, is to assume modules are either CJS
// or that you would set up Babel (@babel/preset-env) to transpile them for Jest.
// For this subtask, we'll proceed as if the mocks are the primary concern.
