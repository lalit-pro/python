// your-ai-copilot/tests/accessibility/audit.js
const puppeteer = require('puppeteer'); // Or playwright if you prefer consistency
const lighthouse = require('lighthouse');
const { URL } = require('url'); // For parsing URL
const fs = require('fs');
const path = require('path');

// This script assumes you have built the HTML files (popup, options, sidebar)
// into a 'dist/html' directory or they are accessible via file:// protocol.
// For Chrome extensions, UI is often tested by loading the extension in a browser.

const HTML_FILES_DIR = path.resolve(__dirname, '../../html'); // Path to your source HTML files
// Or, if you have a build step:
// const HTML_FILES_DIR = path.resolve(__dirname, '../../dist/html');

async function runLighthouseAudit(url, outputFileName) {
  // Use Puppeteer to launch Chrome and control it.
  // Lighthouse will use this existing Chrome instance.
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' }); // Wait for page to load

  const { lhr } = await lighthouse(page.url(), {
    port: (new URL(browser.wsEndpoint())).port,
    output: 'html', // html, json, csv
    logLevel: 'info',
    // onlyCategories: ['accessibility'], // Focus only on accessibility
  }, {
    // Lighthouse config (optional)
    extends: 'lighthouse:default',
    settings: {
      onlyCategories: ['accessibility'],
      // For local file URLs, some audits might not run (e.g., PWA checks)
      // This is generally fine for accessibility of static HTML components.
    },
  });

  await browser.close();

  const reportHtml = lhr.report; // If output: 'html' was used directly in runner.
                                // If runner used {output: 'json'}, then you'd use ReportGenerator.generateReport(lhr, 'html');

  // Ensure output directory exists
  const reportsDir = path.resolve(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  fs.writeFileSync(path.resolve(reportsDir, `${outputFileName}.html`), reportHtml);
  console.log(`Lighthouse accessibility report saved to tests/accessibility/reports/${outputFileName}.html`);
  console.log(`Accessibility Score: ${lhr.categories.accessibility.score * 100}`);

  if (lhr.categories.accessibility.score * 100 < 90) { // Example threshold
    console.warn(`WARNING: Accessibility score for ${outputFileName} is below 90!`);
    // You could make the script exit with an error code here for CI
    // process.exit(1);
  }
}

async function main() {
  const filesToAudit = [
    { name: 'popup_audit', path: path.resolve(HTML_FILES_DIR, 'popup.html') },
    { name: 'options_audit', path: path.resolve(HTML_FILES_DIR, 'options.html') },
    { name: 'sidebar_audit', path: path.resolve(HTML_FILES_DIR, 'sidebar.html') },
  ];

  for (const file of filesToAudit) {
    if (fs.existsSync(file.path)) {
      // Lighthouse needs a URL. Convert file path to file:/// URL.
      const fileUrl = new URL(`file://${file.path}`).href;
      console.log(`Auditing ${file.name} (URL: ${fileUrl})...`);
      await runLighthouseAudit(fileUrl, file.name);
    } else {
      console.warn(`HTML file not found, skipping audit: ${file.path}`);
    }
  }
}

main().catch(err => {
  console.error("Error during Lighthouse audits:", err);
  process.exit(1);
});
