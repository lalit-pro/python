// your-ai-copilot/js/content-scripts/pageExtractor.js

console.log("Page Extractor content script loaded.");

// Function to extract basic page content
function getPageContent() {
  return {
    html: document.documentElement.outerHTML,
    text: document.body.innerText,
    title: document.title,
    url: window.location.href,
  };
}

// Listen for messages from the background script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageContent") {
    try {
      const content = getPageContent();
      sendResponse({ success: true, data: content });
    } catch (error) {
      console.error("Error in getPageContent:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Indicates async response
  } else if (request.action === "injectSidebarTrigger") {
    // Placeholder for injecting a UI element to trigger the sidebar
    // This will be developed further when the sidebar UI is built
    console.log("Request to inject sidebar trigger received.");
    if (!document.getElementById('yourai-sidebar-trigger')) {
      const trigger = document.createElement('div');
      trigger.id = 'yourai-sidebar-trigger';
      trigger.style.position = 'fixed';
      trigger.style.bottom = '20px';
      trigger.style.right = '20px';
      trigger.style.width = '50px';
      trigger.style.height = '50px';
      trigger.style.backgroundColor = '#007bff';
      trigger.style.color = 'white';
      trigger.style.borderRadius = '50%';
      trigger.style.textAlign = 'center';
      trigger.style.lineHeight = '50px';
      trigger.style.cursor = 'pointer';
      trigger.style.zIndex = '99999';
      trigger.innerText = 'AI';
      trigger.onclick = () => {
        // Send message to background/sidebar to toggle visibility
        chrome.runtime.sendMessage({ action: "toggleSidebar" });
      };
      document.body.appendChild(trigger);
      sendResponse({ success: true, message: "Sidebar trigger injected." });
    } else {
      sendResponse({ success: false, message: "Sidebar trigger already exists." });
    }
  }
});

// Example: if the design requires immediate UI injection for a sidebar handle
// This is a simplified example. A more robust solution would involve checking
// if the sidebar iframe/elements already exist.
function ensureSidebarContainer() {
    if (!document.getElementById('yourai-copilot-sidebar-container')) {
        const sidebarContainer = document.createElement('div');
        sidebarContainer.id = 'yourai-copilot-sidebar-container';
        // Styling will be handled by css/sidebar.css, loaded via web_accessible_resources
        // Initially it might be hidden
        sidebarContainer.style.display = 'none'; // Controlled by sidebar.js
        document.body.appendChild(sidebarContainer);
        console.log("YourAI Copilot sidebar container injected.");
    }
}

// Ensure the container is there for the sidebar to load into later.
// Consider doing this on specific user action or if sidebar is enabled by default.
// For now, let's assume it's created when the content script loads.
// ensureSidebarContainer(); // Let's hold off on auto-injecting the main container until sidebar logic is ready

// --- UI Hooks for Sidebar & Popup ---
// This section will be expanded. For now, it's mainly listening for requests.
// For example, a content script could highlight text based on a command from the popup/sidebar.

console.log("Page Extractor content script finished setup.");
