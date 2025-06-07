// your-ai-copilot/tests/jest.config.js
module.exports = {
  verbose: true,
  testEnvironment: 'jsdom', // jest-environment-jsdom v26 often uses jsdom v16.
                                                // Or just 'jsdom' if the default for Jest 26 works.
                                                // 'jest-environment-jsdom-sixteen' is illustrative if specific version needed.
                                                // Standard 'jsdom' should be fine for Jest v26.
  setupFilesAfterEnv: ['./unit/jest.setup.js'], // Path to global setup file.

  // If your CommonJS code still uses modern JavaScript syntax not supported by Node 12
  // (which Jest v26 would run under if your system Node is v12),
  // you'll need Babel to transpile it.
  transform: {
    '^.+\\.js$': 'babel-jest',
  },

  // No need for moduleNameMapper for ES6 module resolution as we are using CommonJS.
  // Other configurations can be added as needed.
  // For Jest v26, coverage reporters and other options are generally similar to newer versions.
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["json", "lcov", "text", "clover"],
  // testMatch: [ // Default is usually fine: finds *.test.js or *.spec.js in __tests__ or tests folders
  //   "**/tests/unit/**/*.test.js"
  // ],
};
