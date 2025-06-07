// your-ai-copilot/js/core/pageMonitor.js

/**
 * @file pageMonitor.js
 * Manages page monitoring tasks: setting up monitors, checking for changes, and notifying users.
 * This module will primarily be used by the background script in conjunction with chrome.alarms.
 */

// --- Constants ---
const MONITOR_STORAGE_PREFIX = 'pageMonitor_'; // Prefix for storing individual monitors
const ALL_MONITORS_KEY = 'allPageMonitors';     // Key for storing the list of all monitor IDs

// --- Monitor Management ---

/**
 * Adds a new page monitor or updates an existing one.
 * @param {object} monitorConfig The configuration for the monitor.
 * @param {string} monitorConfig.id - A unique ID for the monitor (e.g., generated UUID).
 * @param {string} monitorConfig.url - The URL of the page to monitor.
 * @param {string} monitorConfig.selector - CSS selector for the element to monitor.
 * @param {string} [monitorConfig.checkType='text'] - Type of check: 'text', 'html', 'price', 'stock_status'.
 * @param {number} [monitorConfig.frequencyMinutes=60] - How often to check, in minutes.
 * @param {string} [monitorConfig.name] - User-friendly name for the monitor.
 * @param {string} [monitorConfig.initialValue] - Optionally, the initial value detected when setting up.
 * @param {Date} [monitorConfig.createdAt] - Timestamp of creation.
 * @param {Date} [monitorConfig.lastChecked] - Timestamp of last check.
 * @param {string} [monitorConfig.lastKnownValue] - Last known value of the monitored element.
 * @param {string} [monitorConfig.notificationType='basic'] - 'basic', 'webhook'.
 * @param {string} [monitorConfig.webhookUrl] - URL for webhook notification if type is 'webhook'.
 * @returns {Promise<void>}
 */
export async function addOrUpdateMonitor(monitorConfig) {
    if (!monitorConfig.id || !monitorConfig.url || !monitorConfig.selector) {
        throw new Error("Monitor ID, URL, and CSS selector are required.");
    }

    const monitorKey = `${MONITOR_STORAGE_PREFIX}${monitorConfig.id}`;
    const fullConfig = {
        checkType: 'text',
        frequencyMinutes: 60,
        createdAt: new Date().toISOString(),
        lastChecked: null,
        lastKnownValue: monitorConfig.initialValue || null, // Store initial value if provided
        notificationType: 'basic',
        ...monitorConfig // Spread incoming config to override defaults
    };

    try {
        // Save the individual monitor config
        await chrome.storage.local.set({ [monitorKey]: fullConfig });

        // Add its ID to the list of all monitors
        const allMonitorsResult = await chrome.storage.local.get(ALL_MONITORS_KEY);
        const monitorIds = new Set(allMonitorsResult[ALL_MONITORS_KEY] || []);
        monitorIds.add(monitorConfig.id);
        await chrome.storage.local.set({ [ALL_MONITORS_KEY]: Array.from(monitorIds) });

        // Set up a Chrome alarm for this monitor
        // Alarm name needs to be unique, so use the monitorKey or just monitorConfig.id
        // The background script will listen for these alarms.
        chrome.alarms.create(monitorConfig.id, { // Use monitorConfig.id as alarm name
            periodInMinutes: parseInt(fullConfig.frequencyMinutes, 10)
            // delayInMinutes: 1 // Optional: delay initial check
        });

        console.log(`Monitor '${monitorConfig.name || monitorConfig.id}' added/updated and alarm set.`);
    } catch (error) {
        console.error("Error adding/updating monitor:", error);
        throw error;
    }
}

/**
 * Retrieves a specific monitor's configuration.
 * @param {string} monitorId The ID of the monitor.
 * @returns {Promise<object|null>} The monitor configuration or null if not found.
 */
export async function getMonitor(monitorId) {
    const monitorKey = `${MONITOR_STORAGE_PREFIX}${monitorId}`;
    const result = await chrome.storage.local.get(monitorKey);
    return result[monitorKey] || null;
}

/**
 * Retrieves all monitor configurations.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of monitor objects.
 */
export async function getAllMonitors() {
    const allMonitorsResult = await chrome.storage.local.get(ALL_MONITORS_KEY);
    const monitorIds = allMonitorsResult[ALL_MONITORS_KEY] || [];
    if (monitorIds.length === 0) return [];

    const monitorKeys = monitorIds.map(id => `${MONITOR_STORAGE_PREFIX}${id}`);
    const storedMonitors = await chrome.storage.local.get(monitorKeys);

    return Object.values(storedMonitors).filter(Boolean); // Filter out any null/undefined if IDs are stale
}

/**
 * Deletes a monitor.
 * @param {string} monitorId The ID of the monitor to delete.
 * @returns {Promise<void>}
 */
export async function deleteMonitor(monitorId) {
    const monitorKey = `${MONITOR_STORAGE_PREFIX}${monitorId}`;
    try {
        // Remove the individual monitor
        await chrome.storage.local.remove(monitorKey);

        // Remove its ID from the list of all monitors
        const allMonitorsResult = await chrome.storage.local.get(ALL_MONITORS_KEY);
        let monitorIds = allMonitorsResult[ALL_MONITORS_KEY] || [];
        monitorIds = monitorIds.filter(id => id !== monitorId);
        await chrome.storage.local.set({ [ALL_MONITORS_KEY]: monitorIds });

        // Clear the corresponding Chrome alarm
        await chrome.alarms.clear(monitorId); // Use monitorId as alarm name

        console.log(`Monitor '${monitorId}' deleted and alarm cleared.`);
    } catch (error) {
        console.error("Error deleting monitor:", error);
        throw error;
    }
}


// --- Monitor Checking Logic (to be called by background script on alarm) ---

/**
 * Checks a specific monitor for changes.
 * This function is intended to be called by the background script when an alarm fires.
 * @param {string} monitorId The ID of the monitor to check.
 * @returns {Promise<void>}
 */
export async function checkMonitorForChanges(monitorId) {
    const monitor = await getMonitor(monitorId);
    if (!monitor) {
        console.warn(`Monitor ${monitorId} not found for checking. It might have been deleted.`);
        await chrome.alarms.clear(monitorId); // Clean up stray alarm
        return;
    }

    console.log(`Checking monitor: ${monitor.name || monitor.id} for URL: ${monitor.url}`);

    try {
        // Fetch the page content. This is tricky.
        // Direct fetch from background might hit CORS or not render JS.
        // Best way: use scripting.executeScript on a tab if one is open to that URL,
        // or an offscreen document for headless fetching.
        // For simplicity, let's assume a helper in background.js `fetchPageElementContent(url, selector, checkType)`

        const response = await chrome.runtime.sendMessage({
            action: 'fetchPageElementForMonitor',
            data: {
                url: monitor.url,
                selector: monitor.selector,
                checkType: monitor.checkType // 'text' or 'html'
            }
        });

        if (!response || !response.success) {
            console.error(`Failed to fetch content for monitor ${monitor.id}: ${response?.error}`);
            // Optionally update lastChecked with error status
            monitor.lastChecked = new Date().toISOString();
            // monitor.lastError = response?.error || "Fetch failed";
            await chrome.storage.local.set({ [`${MONITOR_STORAGE_PREFIX}${monitor.id}`]: monitor });
            return;
        }

        const currentValue = response.data; // This is the text or HTML content of the element

        console.log(`Monitor ${monitor.id}: Last known value: '${monitor.lastKnownValue}', Current value: '${currentValue}'`);

        let hasChanged = false;
        if (monitor.lastKnownValue === null && currentValue !== null) { // First check with a value
            hasChanged = true; // Or treat first fetch as baseline, no notification
            console.log(`Monitor ${monitor.id}: First value detected. Setting as baseline.`);
        } else if (monitor.lastKnownValue !== currentValue) {
            hasChanged = true;
        }

        monitor.lastChecked = new Date().toISOString();

        if (hasChanged) {
            console.log(`CHANGE DETECTED for monitor ${monitor.id}! New value: ${currentValue}`);
            monitor.lastKnownValue = currentValue;
            await notifyUser(monitor, currentValue);
        } else {
            console.log(`No change detected for monitor ${monitor.id}.`);
        }
        // Update monitor with lastChecked and potentially new lastKnownValue
        await chrome.storage.local.set({ [`${MONITOR_STORAGE_PREFIX}${monitor.id}`]: monitor });

    } catch (error) {
        console.error(`Error checking monitor ${monitor.id}:`, error);
        // Update lastChecked with error status
        monitor.lastChecked = new Date().toISOString();
        // monitor.lastError = error.message;
        await chrome.storage.local.set({ [`${MONITOR_STORAGE_PREFIX}${monitor.id}`]: monitor });
    }
}

/**
 * Notifies the user about a detected change.
 * @param {object} monitor The monitor configuration.
 * @param {string} newValue The new value that was detected.
 */
async function notifyUser(monitor, newValue) {
    const title = `Change Detected: ${monitor.name || monitor.id}`;
    const message = `The monitored element at ${monitor.url} has changed.
Old: ${monitor.lastKnownValue}
New: ${newValue}`;

    if (monitor.notificationType === 'webhook' && monitor.webhookUrl) {
        try {
            await fetch(monitor.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    monitorId: monitor.id,
                    monitorName: monitor.name,
                    url: monitor.url,
                    selector: monitor.selector,
                    oldValue: monitor.lastKnownValue, // This will be the value before this change
                    newValue: newValue,
                    timestamp: new Date().toISOString()
                })
            });
            console.log(`Webhook notification sent for monitor ${monitor.id}`);
        } catch (error) {
            console.error(`Failed to send webhook for monitor ${monitor.id}:`, error);
            // Fallback to basic notification if webhook fails? Or just log.
        }
    } else { // Default to 'basic' notification
        chrome.notifications.create(`monitorChange_${monitor.id}_${Date.now()}`, {
            type: 'basic',
            iconUrl: 'assets/icons/icon128.png', // Ensure this path is correct from manifest
            title: title,
            message: message,
            priority: 2,
            // buttons: [{ title: "View Page" }] // Can add buttons
        });
        // TODO: Handle notification button clicks if added (e.g., open monitor.url)
        console.log(`Basic notification created for monitor ${monitor.id}`);
    }
}


// --- Helper for background script to fetch content ---
// The actual implementation of fetching page content for a monitor is complex.
// It needs to happen in the background script, potentially using an offscreen document
// or by injecting a content script into an existing tab if the URL is already open.
// `chrome.runtime.sendMessage({ action: 'fetchPageElementForMonitor', ... })` assumes
// background.js has a handler for this.

// Example (conceptual) of what background.js might do for 'fetchPageElementForMonitor':
/*
async function handleFetchPageElementForMonitor(data, sendResponse) {
    const { url, selector, checkType } = data;
    try {
        // Option 1: Use offscreen document (Manifest V3 recommended for headless fetch & DOM)
        // Requires 'OFFSCREEN' permission and setup.
        // const fetchedValue = await callOffscreenDocumentToFetch(url, selector, checkType);
        // sendResponse({ success: true, data: fetchedValue });

        // Option 2: If a tab with this URL is open, inject a script (less reliable for background checks)
        // const [tab] = await chrome.tabs.query({ url: url, status: 'complete' });
        // if (tab) { ... scripting.executeScript ... }

        // Option 3: Simple fetch (might not work for SPAs, CORS issues)
        // const response = await fetch(url);
        // const html = await response.text();
        // const parser = new DOMParser();
        // const doc = parser.parseFromString(html, "text/html");
        // const element = doc.querySelector(selector);
        // sendResponse({ success: true, data: checkType === 'html' ? element.innerHTML : element.textContent });

        // For this stub, we'll simulate an error as real implementation is complex.
        sendResponse({ success: false, error: "Fetching mechanism not fully implemented in this stub."});
    } catch (e) {
        sendResponse({ success: false, error: e.message });
    }
    return true; // For async
}
*/

// Example of how background.js would use this module:
//
// chrome.alarms.onAlarm.addListener(async (alarm) => {
//   if (alarm.name.startsWith(MONITOR_STORAGE_PREFIX_ALARM_TAG)) { // Check if it's one of our monitor alarms
//     const monitorId = alarm.name; // Assuming alarm name is monitorId
//     await checkMonitorForChanges(monitorId);
//   }
// });
//
// // When a notification button is clicked (if buttons are added)
// chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
//   if (notificationId.startsWith('monitorChange_')) {
//     // Extract monitor ID and URL, then open the page
//   }
// });
