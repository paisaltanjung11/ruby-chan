importScripts("./rubychan.js");

console.log("Rubychan background service starting up...");
const extensionCore = RubyChanMain;
extensionCore.init();

chrome.action.onClicked.addListener(extensionCore.onClicked);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (message.type) {
    case "checkEnabled":
      if (tabId) {
        extensionCore.sendEnabled(tabId);
      }
      break;

    case "getFurigana":
      if (!tokenizer) {
        console.log("Tokenizer not ready - initializing language processor");
        extensionCore.initializeTokenizer();
      }

      extensionCore.getFurigana(message.data, sendResponse);
      return true;

    case "enableRubychan":
      extensionCore.enabled = true;
      chrome.storage.local.set({ rubychanEnabled: true });

      updateAllTabs();
      break;

    case "disableRubychan":
      extensionCore.enabled = false;
      chrome.storage.local.set({ rubychanEnabled: false });

      updateAllTabs();
      break;

    default:
      console.log("Unrecognized message type:", message);
  }
});

function updateAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        extensionCore.sendEnabled(tab.id);
      }
    });
  });
}
