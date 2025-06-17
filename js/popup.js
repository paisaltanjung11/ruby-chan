document.addEventListener("DOMContentLoaded", function () {
  const enableToggle = document.getElementById("enableToggle");

  chrome.storage.local.get("rubychanEnabled", function (value) {
    enableToggle.checked = value.rubychanEnabled !== false;
  });

  enableToggle.addEventListener("change", function () {
    const isEnabled = enableToggle.checked;

    chrome.storage.local.set(
      {
        rubychanEnabled: isEnabled,
      },
      function () {
        chrome.runtime.sendMessage({
          type: isEnabled ? "enableRubychan" : "disableRubychan",
        });
      }
    );
  });
});
