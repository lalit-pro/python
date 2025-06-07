// your-ai-copilot/js/content-scripts/youtubeExtractor.js

console.log("YouTube Extractor content script loaded.");

/**
 * Attempts to find and extract the YouTube video transcript from the DOM.
 * This is a fallback if the YouTube Data API is not used or fails.
 * YouTube's DOM structure can change, so this is fragile.
 */
async function getTranscriptFromDOM() {
  try {
    // Click the "Show transcript" button
    const threeDotsButton = document.querySelector('button[aria-label="More actions"]');
    if (threeDotsButton) threeDotsButton.click();

    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for menu to appear

    const showTranscriptButton = Array.from(document.querySelectorAll('yt-formatted-string, ytd-menu-service-item-renderer'))
                                     .find(el => el.textContent.trim().toLowerCase() === 'show transcript');

    if (!showTranscriptButton) {
        // Try another common path if the first one fails (e.g. if menu already open via three dots)
        const descriptionInfo = document.querySelector("#description-inner .ytd-watch-metadata");
        if (descriptionInfo) {
            const menuRenderer = descriptionInfo.querySelector("ytd-menu-renderer > yt-button-shape > button");
            if(menuRenderer) menuRenderer.click();
            await new Promise(resolve => setTimeout(resolve, 200)); // wait for menu
            const transcriptButtonInMenu = Array.from(document.querySelectorAll('ytd-menu-service-item-renderer'))
                                     .find(el => el.textContent.trim().toLowerCase() === 'show transcript');
            if (transcriptButtonInMenu) transcriptButtonInMenu.click();
            else {
                 // If "Show transcript" is not in a menu, it might be directly available after "More actions"
                 // This part is highly dependent on YouTube's ever-changing UI
                 console.warn("Could not find 'Show transcript' button directly after 'More actions'.");
            }
        } else {
            console.warn("Could not find the three-dots menu or description info for transcript.");
           // Attempt to close any open dialogs/menus that might obscure transcript button
            const closeButton = document.querySelector('yt-icon-button[aria-label="Close"]');
            if (closeButton) closeButton.click();
            await new Promise(resolve => setTimeout(resolve, 200));
            // Re-attempt finding show transcript button after potential close
            const showTranscriptButtonAgain = Array.from(document.querySelectorAll('yt-formatted-string, ytd-menu-service-item-renderer'))
                                     .find(el => el.textContent.trim().toLowerCase() === 'show transcript');
            if(showTranscriptButtonAgain) showTranscriptButtonAgain.click();
            else {
                console.warn("Could not find 'Show transcript' button after attempting to close dialogs.");
                // return { error: "Could not find 'Show transcript' button." };
            }
        }
    } else {
         showTranscriptButton.click();
    }


    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for transcript panel to load

    const transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer');
    if (!transcriptSegments || transcriptSegments.length === 0) {
      // Fallback: Check for newer YouTube UI (e.g., `ytmusic-transcript-segment-renderer`)
      // Or other custom elements they might use. This needs to be adaptable.
      const alternativeSegments = document.querySelectorAll('ytmusic-transcript-segment-renderer, .ytd-transcript-segment-list-renderer'); // Add more if found
      if (!alternativeSegments || alternativeSegments.length === 0) {
        console.warn("Transcript segments not found in standard or alternative paths.");
        // Try to close the transcript panel if it was opened but no segments found
        const closeTranscriptButton = document.querySelector('button[aria-label="Close transcript"], #dismiss-button');
        if(closeTranscriptButton) closeTranscriptButton.click();
        return { error: "Transcript segments not found. The video might not have a transcript or the UI has changed." };
      }
      // If alternative segments found, proceed with them
      // This part of logic would need to be similar to how transcriptSegments are processed
    }

    let fullTranscript = "";
    transcriptSegments.forEach(segment => {
      const textElement = segment.querySelector('.segment-text, .ytd-transcript-segment-renderer-text'); // Adapt selectors
      if (textElement) {
        fullTranscript += textElement.innerText + " ";
      }
    });

    // Attempt to close the transcript panel
    const closeTranscriptButton = document.querySelector('button[aria-label="Close transcript"], #dismiss-button');
    if(closeTranscriptButton) closeTranscriptButton.click();

    return { transcript: fullTranscript.trim() };

  } catch (error) {
    console.error("Error getting transcript from DOM:", error);
    return { error: `Error getting transcript from DOM: ${error.message}` };
  }
}


// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTranscript") {
    // Priority:
    // 1. YouTube Data API (if implemented and API key available - handled in background.js or a core module)
    // 2. DOM scraping (this script)

    // For now, this content script directly tries DOM scraping.
    // A more complete version would first check if background has a better version.
    console.log("Request to get YouTube transcript received.");
    getTranscriptFromDOM()
      .then(result => {
        if (result.error) {
          sendResponse({ success: false, error: result.error, source: "DOM" });
        } else {
          sendResponse({ success: true, data: result.transcript, source: "DOM" });
        }
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message, source: "DOM" });
      });
    return true; // Indicates async response
  }
});

console.log("YouTube Extractor content script finished setup.");

// Note: Interacting with YouTube's DOM is inherently fragile.
// The selectors used above are examples and will likely need frequent updates
// as YouTube changes its website structure.
// Using the official YouTube Data API (Transcripts endpoint) is more robust
// but requires API quotas and user authentication/API key management.
