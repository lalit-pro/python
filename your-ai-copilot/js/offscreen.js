// your-ai-copilot/js/offscreen.js
console.log("Offscreen document script loaded.");

chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(request, sender, sendResponse) {
    if (request.target !== 'offscreen') {
        return false; // Indicate message not handled by this listener
    }

    console.log('Offscreen document received message:', request);

    switch (request.action) {
        case 'fetchPageElement':
            try {
                const { url, selector, checkType } = request.data;
                if (!url || !selector) {
                    throw new Error("URL and selector are required for fetchPageElement.");
                }
                const content = await fetchAndExtract(url, selector, checkType || 'text');
                sendResponse({ success: true, data: content });
            } catch (error) {
                console.error('Error in offscreen fetchPageElement:', error);
                sendResponse({ success: false, error: error.message });
            }
            return true; // Indicates that the response is sent asynchronously
        default:
            console.warn(`Unknown action received in offscreen document: ${request.action}`);
            sendResponse({ success: false, error: `Unknown action: ${request.action}` });
            return false;
    }
}

async function fetchAndExtract(url, selector, checkType = 'text') {
    console.log(`Offscreen: Fetching URL: ${url}, Selector: ${selector}, Type: ${checkType}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        }
        const html = await response.text();

        // Use DOMParser to parse the HTML string
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const element = doc.querySelector(selector);

        if (!element) {
            console.warn(`Offscreen: Element with selector "${selector}" not found on ${url}.`);
            return null; // Or throw new Error('Element not found');
        }

        if (checkType === 'html') {
            return element.innerHTML;
        }
        return element.textContent.trim();

    } catch (error) {
        console.error(`Offscreen: Error during fetch or extraction for ${url} with selector ${selector}:`, error);
        throw error; // Re-throw to be caught by the message handler
    }
}
