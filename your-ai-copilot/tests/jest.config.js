// your-ai-copilot/tests/jest.config.js
module.exports = {
  verbose: true,
  testEnvironment: 'jest-environment-jsdom', // Or 'node' if not testing DOM-related things directly
  // setupFilesAfterEnv: ['./jest.setup.js'], // If you need global setup like mocks
  moduleNameMapper: {
    // If you're using ES6 modules and need to map them for Jest
    '^../js/core/(.*)$': '<rootDir>/../js/core/$1', // Adjust path as necessary
  },
  // Jest by default doesn't support ES6 modules directly in .js files without experimental flags or babel
  // transform: { '^.+\.js$': 'babel-jest', }, // If you set up Babel
  // For simplicity, if core modules are simple JS or tests mock chrome.*, this might be okay.
  // Otherwise, you might need Babel or ensure modules are CJS compatible for testing.
  // For now, let's assume core modules are written in a way Jest can handle or mocks are sufficient.
  // This configuration might need adjustment based on the exact JS module format and Babel setup.
  // If using ES modules directly in Node (experimental for Jest), specific Jest config is needed.
  // For this project, we'll assume manual mocking of chrome APIs.
};
