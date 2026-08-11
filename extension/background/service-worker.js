chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SETTINGS_UPDATED') {
    chrome.storage.local.set({ settings: msg.settings });
  }
  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.local.get(['settings']).then((result) => sendResponse(result.settings || {}));
    return true;
  }
});
