// your-ai-copilot/tests/playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e', // Directory where E2E tests are located
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html', // Generates an HTML report
  use: {
    baseURL: 'http://localhost:3000', // If you have a local dev server for testing UI components
    trace: 'on-first-retry',
    // Specify browser and context options for loading the extension
    // This requires building the extension and loading it.
    // The exact method depends on how you serve/load the extension for testing.
    // For Chrome extensions, you often need to launch Chrome with specific arguments.
    // Example for launching Chrome with an unpacked extension:
    // launchOptions: {
    //   headless: false, // Run headed for debugging, true for CI
    //   args: [
    //     `--disable-extensions-except=/path/to/your-ai-copilot/dist`, // Path to built extension
    //     `--load-extension=/path/to/your-ai-copilot/dist`,
    //   ],
    // },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  // webServer: { // If you need to start a local dev server
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
