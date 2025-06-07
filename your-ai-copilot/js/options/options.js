// your-ai-copilot/js/options/options.js
document.addEventListener('DOMContentLoaded', () => {
    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(`${button.dataset.tab}-tab-content`).classList.add('active');
        });
    });

    // API Keys Section
    const defaultProviderSelect = document.getElementById('defaultProvider');
    const openaiApiKeyInput = document.getElementById('openaiApiKey');
    const anthropicApiKeyInput = document.getElementById('anthropicApiKey');
    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    const saveApiKeysBtn = document.getElementById('saveApiKeysBtn');
    const apiKeyStatus = document.getElementById('apiKeyStatus');
    const toggleVisibilityButtons = document.querySelectorAll('.toggle-visibility');

    toggleVisibilityButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            const targetInput = document.getElementById(targetId);
            if (targetInput.type === 'password') {
                targetInput.type = 'text';
                button.textContent = 'Hide';
            } else {
                targetInput.type = 'password';
                button.textContent = 'Show';
            }
        });
    });

    // Features Section
    const featureCheckboxes = document.querySelectorAll('.feature-checkbox');
    const saveFeaturesBtn = document.getElementById('saveFeaturesBtn');
    const featureStatus = document.getElementById('featureStatus');

    // Permissions Section
    const hostPermissionsList = document.getElementById('hostPermissionsList');
    const requestAllUrlsBtn = document.getElementById('requestAllUrlsBtn');
    const permissionStatus = document.getElementById('permissionStatus');

    // Data Management Section
    const exportAllDataBtn = document.getElementById('exportAllDataBtn');
    const clearAllDataBtn = document.getElementById('clearAllDataBtn');
    const dataManagementStatus = document.getElementById('dataManagementStatus');

    // About Section
    const extensionVersionSpan = document.getElementById('extensionVersion');


    // --- Utility to show status messages ---
    function showStatus(element, message, isSuccess = true, duration = 3000) {
        element.textContent = message;
        element.className = `status-message ${isSuccess ? 'success' : 'error'}`;
        setTimeout(() => {
            element.textContent = '';
            element.className = 'status-message';
        }, duration);
    }

    // --- Load settings ---
    async function loadSettings() {
        // API Keys & Default Provider
        const apiData = await chrome.storage.local.get(['apiKeys', 'userSettings']);
        if (apiData.apiKeys) {
            openaiApiKeyInput.value = apiData.apiKeys.openai || '';
            anthropicApiKeyInput.value = apiData.apiKeys.anthropic || '';
            geminiApiKeyInput.value = apiData.apiKeys.gemini || '';
        }
        if (apiData.userSettings && apiData.userSettings.defaultProvider) {
            defaultProviderSelect.value = apiData.userSettings.defaultProvider;
        }

        // Feature Flags
        if (apiData.userSettings && apiData.userSettings.featureFlags) {
            featureCheckboxes.forEach(checkbox => {
                const featureName = checkbox.dataset.feature;
                checkbox.checked = apiData.userSettings.featureFlags[featureName] !== undefined ? apiData.userSettings.featureFlags[featureName] : true; // Default to true if not set
            });
        } else { // Default all to true if no settings exist
             featureCheckboxes.forEach(checkbox => checkbox.checked = true);
        }

        // Version
        const manifest = chrome.runtime.getManifest();
        extensionVersionSpan.textContent = manifest.version;

        // Permissions
        loadHostPermissions();
    }

    // --- Save API Keys ---
    if (saveApiKeysBtn) {
        saveApiKeysBtn.addEventListener('click', async () => {
            const apiKeys = {
                openai: openaiApiKeyInput.value.trim(),
                anthropic: anthropicApiKeyInput.value.trim(),
                gemini: geminiApiKeyInput.value.trim(),
            };
            const userSettings = (await chrome.storage.local.get('userSettings')).userSettings || {};
            userSettings.defaultProvider = defaultProviderSelect.value;

            try {
                await chrome.storage.local.set({ apiKeys, userSettings });
                showStatus(apiKeyStatus, 'API keys and default provider saved successfully!', true);
            } catch (error) {
                console.error("Error saving API keys:", error);
                showStatus(apiKeyStatus, `Error saving API keys: ${error.message}`, false);
            }
        });
    }

    // --- Save Feature Settings ---
    if (saveFeaturesBtn) {
        saveFeaturesBtn.addEventListener('click', async () => {
            const userSettings = (await chrome.storage.local.get('userSettings')).userSettings || {};
            userSettings.featureFlags = userSettings.featureFlags || {}; // Ensure featureFlags object exists

            featureCheckboxes.forEach(checkbox => {
                userSettings.featureFlags[checkbox.dataset.feature] = checkbox.checked;
            });

            try {
                await chrome.storage.local.set({ userSettings });
                showStatus(featureStatus, 'Feature settings saved successfully!', true);
                 // Notify background script if sidebar enable/disable changes, so it can react
                if (userSettings.featureFlags.sidebar !== undefined) {
                    chrome.runtime.sendMessage({ action: "featureFlagsChanged", newSettings: userSettings.featureFlags });
                }
            } catch (error) {
                console.error("Error saving feature settings:", error);
                showStatus(featureStatus, `Error saving settings: ${error.message}`, false);
            }
        });
    }

    // --- Permissions Management ---
    async function loadHostPermissions() {
        hostPermissionsList.innerHTML = ''; // Clear current list
        try {
            const currentPermissions = await chrome.permissions.getAll();
            const origins = currentPermissions.origins || [];

            if (origins.length === 0) {
                hostPermissionsList.innerHTML = '<p>No specific host permissions granted yet.</p>';
            } else {
                origins.forEach(origin => {
                    if (origin === '<all_urls>') { // Special handling for all_urls
                        const div = document.createElement('div');
                        div.innerHTML = `<span><strong>${origin}</strong> (Full access to all websites)</span> <span>Cannot be revoked here. Manage in extension settings.</span>`;
                        hostPermissionsList.appendChild(div);
                    } else {
                        const div = document.createElement('div');
                        div.innerHTML = `<span>${origin}</span> <button data-origin="${origin}" class="revoke-permission-btn">Revoke</button>`;
                        hostPermissionsList.appendChild(div);
                    }
                });

                document.querySelectorAll('.revoke-permission-btn').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const originToRevoke = e.target.dataset.origin;
                        try {
                            const Succeeded = await chrome.permissions.remove({ origins: [originToRevoke] });
                            if (Succeeded) {
                                showStatus(permissionStatus, `Permission for ${originToRevoke} revoked.`, true);
                                loadHostPermissions(); // Refresh list
                            } else {
                                showStatus(permissionStatus, `Failed to revoke permission for ${originToRevoke}.`, false);
                            }
                        } catch (err) {
                             showStatus(permissionStatus, `Error revoking permission: ${err.message}`, false);
                        }
                    });
                });
            }
             // Check if <all_urls> is already granted
            if (origins.includes('<all_urls>')) {
                requestAllUrlsBtn.disabled = true;
                requestAllUrlsBtn.textContent = '`all_urls` Permission Granted';
            } else {
                requestAllUrlsBtn.disabled = false;
                requestAllUrlsBtn.textContent = 'Request `<all_urls>` Permission';
            }


        } catch (error) {
            console.error("Error loading host permissions:", error);
            hostPermissionsList.innerHTML = '<p>Error loading permissions information.</p>';
        }
    }

    if (requestAllUrlsBtn) {
        requestAllUrlsBtn.addEventListener('click', async () => {
            try {
                const granted = await chrome.permissions.request({ origins: ["<all_urls>"] });
                if (granted) {
                    showStatus(permissionStatus, '`<all_urls>` permission granted!', true);
                    loadHostPermissions(); // Refresh list
                } else {
                    showStatus(permissionStatus, '`<all_urls>` permission not granted.', false);
                }
            } catch (error) {
                console.error("Error requesting <all_urls> permission:", error);
                showStatus(permissionStatus, `Error: ${error.message}`, false);
            }
        });
    }


    // --- Data Management ---
    if (exportAllDataBtn) {
        exportAllDataBtn.addEventListener('click', async () => {
            try {
                // Get all data from chrome.storage.local and chrome.storage.sync
                const localData = await chrome.storage.local.get(null);
                const syncData = await chrome.storage.sync.get(null);

                // Get IndexedDB data
                let indexedDbData = {};
                try {
                    const dbRequest = indexedDB.open('YourAICopilotDB', 1);
                    indexedDbData = await new Promise((resolve, reject) => {
                        dbRequest.onsuccess = async (event) => {
                            const db = event.target.result;
                            const transaction = db.transaction(db.objectStoreNames, 'readonly');
                            const data = {};
                            for (const storeName of db.objectStoreNames) {
                                data[storeName] = await new Promise((res, rej) => {
                                    const store = transaction.objectStore(storeName);
                                    const getAllReq = store.getAll();
                                    getAllReq.onsuccess = () => res(getAllReq.result);
                                    getAllReq.onerror = (e) => rej(e.target.error);
                                });
                            }
                            resolve(data);
                        };
                        dbRequest.onerror = (event) => reject(event.target.error);
                    });
                } catch (dbError) {
                    console.warn("Could not export IndexedDB data:", dbError);
                    // Continue with storage export even if DB fails
                }


                const allData = {
                    chromeStorageLocal: localData,
                    chromeStorageSync: syncData,
                    indexedDB: indexedDbData,
                    exportTimestamp: new Date().toISOString()
                };

                const dataStr = JSON.stringify(allData, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `yourai_copilot_alldata_${new Date().toISOString().slice(0,10)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showStatus(dataManagementStatus, 'All extension data exported.', true);
            } catch (error) {
                console.error("Error exporting data:", error);
                showStatus(dataManagementStatus, `Error exporting data: ${error.message}`, false);
            }
        });
    }

    if (clearAllDataBtn) {
        clearAllDataBtn.addEventListener('click', async () => {
            if (confirm("ARE YOU SURE you want to clear ALL extension data? This includes API keys, settings, and all history. This action cannot be undone.")) {
                try {
                    await chrome.storage.local.clear();
                    await chrome.storage.sync.clear(); // Be careful with sync, it might affect other instances

                    // Clear IndexedDB
                    const dbRequest = indexedDB.open('YourAICopilotDB', 1);
                    await new Promise((resolve, reject) => {
                         dbRequest.onsuccess = async (event) => {
                            const db = event.target.result;
                            const storeNames = Array.from(db.objectStoreNames);
                            if (storeNames.length === 0) {
                                resolve(); return;
                            }
                            const transaction = db.transaction(storeNames, 'readwrite');
                            let clearedCount = 0;
                            storeNames.forEach(storeName => {
                                transaction.objectStore(storeName).clear().onsuccess = () => {
                                    clearedCount++;
                                    if (clearedCount === storeNames.length) resolve();
                                };
                            });
                            transaction.onerror = (e) => reject(e.target.error);
                            transaction.oncomplete = () => resolve(); // Ensure resolve is called
                        };
                        dbRequest.onerror = (event) => reject(event.target.error);
                    });


                    showStatus(dataManagementStatus, 'All extension data has been cleared. Please reload the extension.', true, 5000);
                    // Reload inputs to reflect cleared state
                    loadSettings();
                    openaiApiKeyInput.value = '';
                    anthropicApiKeyInput.value = '';
                    geminiApiKeyInput.value = '';
                    defaultProviderSelect.value = 'openai';
                    featureCheckboxes.forEach(cb => cb.checked = true); // Reset to defaults

                } catch (error) {
                    console.error("Error clearing data:", error);
                    showStatus(dataManagementStatus, `Error clearing data: ${error.message}`, false);
                }
            }
        });
    }

    // --- Initial Load ---
    loadSettings();
});
