var RubyContentBundle = {
  popupSpacing: 8,
  enabled: false,
  oldSelectionText: "",
  expand: true,
  setting: {
    backgroundColor: "rgba(33, 33, 33, 0.97)",
    textColor: "#eeeeee",
    kanjiColor: "#ffffff",
    nonKanjiColor: "#ff6666",
    textFontSize: 17,
    definitionTextColor: "#cccccc",
    definitionBackgroundColor: "rgba(22, 22, 22, 0.7)",
  },
  isInteractingWithPopup: false,
  isSelectionInsidePopup: function () {
    const selObj = window.getSelection();
    if (selObj && selObj.rangeCount > 0) {
      const range = selObj.getRangeAt(0);
      if (range) {
        const container = range.commonAncestorContainer;
        return (
          (container.closest && container.closest(".rubychan-popup")) ||
          (container.parentNode &&
            container.parentNode.closest &&
            container.parentNode.closest(".rubychan-popup"))
        );
      }
    }
    return false;
  },

  enable: function () {
    if (RubyContentBundle.enabled) {
      return;
    }
    RubyContentBundle.enabled = true;

    window.addEventListener("mousedown", this.onMouseDown, false);
    window.addEventListener("mouseup", this.onMouseUp, false);
    document.addEventListener("selectionchange", this.onSelectionchange, false);

    document.addEventListener("click", this.onOutsideClick, false);
  },

  disable: function () {
    if (!RubyContentBundle.enabled) {
      return;
    }
    RubyContentBundle.enabled = false;
    RubyContentBundle.closePopup();
    window.removeEventListener("mousedown", this.onMouseDown, false);
    window.removeEventListener("mouseup", this.onMouseUp, false);
    window.removeEventListener(
      "selectionchange",
      this.onSelectionchange,
      false
    );
    document.removeEventListener("click", this.onOutsideClick, false);
  },

  onMouseUp: function (event) {
    if (RubyContentBundle.isInteractingWithPopup) {
      return;
    }

    var selection = RubyContentBundle.getSelection();
    if (
      selection == null ||
      (RubyContentBundle.oldSelectionText == selection.selectionText &&
        document.querySelectorAll(".rubychan-popup").length > 0)
    ) {
      return;
    }

    if (selection !== null && selection.selectionText !== "") {
      if (RubyContentBundle.isSelectionInsidePopup()) {
        return;
      }

      try {
        chrome.runtime.sendMessage(
          {
            type: "getFurigana",
            data: selection.selectionText,
          },
          function (response) {
            if (!response) {
              return;
            }

            var checkSelection = RubyContentBundle.getSelection();
            if (
              RubyContentBundle.enabled &&
              checkSelection != null &&
              checkSelection.selectionText != ""
            ) {
              RubyContentBundle.closePopup();
              RubyContentBundle.showPopup(selection, response);
              RubyContentBundle.oldSelectionText =
                selection != null ? selection.selectionText : "";

              if (response.waitingForTokenizer) {
                setTimeout(() => {
                  chrome.runtime.sendMessage(
                    {
                      type: "getFurigana",
                      data: selection.selectionText,
                    },
                    function (newResponse) {
                      if (newResponse && !newResponse.waitingForTokenizer) {
                        RubyContentBundle.closePopup();
                        RubyContentBundle.showPopup(selection, newResponse);
                      }
                    }
                  );
                }, 1000);
              }
            }
          }
        );
      } catch (e) {
        console.error("Error in onMouseUp:", e);
      }
    }
  },
  onMouseDown: function (event) {
    if (event.target.closest(".rubychan-popup")) {
      event.stopPropagation();

      RubyContentBundle.isInteractingWithPopup = true;

      document.addEventListener(
        "mouseup",
        function clearFlag() {
          RubyContentBundle.isInteractingWithPopup = false;
          document.removeEventListener("mouseup", clearFlag);
        },
        { once: true }
      );

      var audioButton = event.target.closest(".rubychan-audio-button");
      if (audioButton) {
        const word = audioButton.getAttribute("data-word");
        if (word && !audioButton.disabled) {
          audioButton.disabled = true;
          audioButton.classList.add("rubychan-audio-playing");

          speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(word);
          utterance.lang = "ja-JP";

          utterance.onend = function () {
            audioButton.disabled = false;
            audioButton.classList.remove("rubychan-audio-playing");
          };

          utterance.onerror = function () {
            audioButton.disabled = false;
            audioButton.classList.remove("rubychan-audio-playing");
          };

          speechSynthesis.speak(utterance);
        }
      }
      return;
    }

    RubyContentBundle.isInteractingWithPopup = false;
  },

  onSelectionchange: function (event) {
    if (
      RubyContentBundle.isInteractingWithPopup ||
      RubyContentBundle.isSelectionInsidePopup()
    ) {
      return;
    }

    RubyContentBundle.closePopup();
  },
  showPopup: function (selection, response) {
    var popup = document.createElement("div");
    popup.style.backgroundColor = RubyContentBundle.setting.backgroundColor;
    popup.classList.add("rubychan-popup");
    popup.id = "rubychan-popup-container";

    var rubychanContent = document.createElement("div");
    rubychanContent.style.color = RubyContentBundle.setting.textColor;
    rubychanContent.style.fontSize =
      RubyContentBundle.setting.textFontSize + "px";
    rubychanContent.classList.add("rubychan-content");
    rubychanContent.innerHTML = response.furigana;
    popup.appendChild(rubychanContent);

    var rubychanDefinitions = document.createElement("div");
    rubychanDefinitions.classList.add("rubychan-definitions-container");
    rubychanDefinitions.id = "rubychan-definitions-container";
    rubychanDefinitions.style.backgroundColor =
      RubyContentBundle.setting.definitionBackgroundColor;
    rubychanDefinitions.style.color =
      RubyContentBundle.setting.definitionTextColor;
    rubychanDefinitions.innerHTML =
      '<div class="rubychan-loading">Looking up definitions...</div>';
    popup.appendChild(rubychanDefinitions);

    document.body.appendChild(popup);

    // Debug check to verify popup was added to DOM
    console.log(
      "Popup added to DOM:",
      !!document.querySelector(".rubychan-popup")
    );
    console.log(
      "Definitions container exists:",
      !!document.getElementById("rubychan-definitions-container")
    );

    if (response.definitions) {
      console.log("Initial definitions provided, updating container");
      rubychanDefinitions.innerHTML =
        response.definitions ||
        '<div class="rubychan-loading">Looking up definitions...</div>';
    }

    document
      .querySelectorAll(".rubychan-content>ruby")
      .forEach(function (word) {
        word.style.color = RubyContentBundle.setting.kanjiColor;
        word.style.fontSize = RubyContentBundle.setting.textFontSize + "px";
      });
    document
      .querySelectorAll(".rubychan-content>ruby>rt")
      .forEach(function (word) {
        word.style.color = RubyContentBundle.setting.nonKanjiColor;
        word.style.fontSize = RubyContentBundle.setting.textFontSize - 4 + "px";
      });

    var _style = window.getComputedStyle(popup, null);
    let horizontalPadding =
      parseFloat(_style.paddingLeft) + parseFloat(_style.paddingRight);
    let verticalPadding =
      parseFloat(_style.paddingTop) + parseFloat(_style.paddingBottom);
    let maxWidth =
      Math.max(selection.maxWidth, selection.width) - horizontalPadding;
    popup.style.maxWidth = Math.ceil(maxWidth) + "px";

    var range = document.createRange();
    range.selectNodeContents(rubychanContent);
    let width = Math.ceil(
      Math.min(maxWidth, range.getBoundingClientRect().width)
    );
    width = Math.max(width, 200);
    popup.style.width = Math.ceil(width) + "px";
    window.getSelection().removeRange(range);

    rubychanContent.style.minHeight = "30px";

    let right =
      document.documentElement.clientWidth -
      (selection.right + document.documentElement.scrollLeft);
    right = Math.min(
      right,
      document.documentElement.clientWidth - width - horizontalPadding
    );
    right = Math.max(right, 10);
    popup.style.right = right + "px";
    if (
      selection.top - popup.clientHeight - RubyContentBundle.popupSpacing <
      0
    ) {
      let y =
        selection.bottom +
        document.documentElement.scrollTop +
        RubyContentBundle.popupSpacing;
      popup.classList.add("rubychan-popup-bottom");
      popup.style.top = y + "px";
    } else {
      let y =
        document.documentElement.clientHeight -
        (selection.top + document.documentElement.scrollTop) +
        RubyContentBundle.popupSpacing;
      if ("relative" == window.getComputedStyle(document.body, null).position) {
        y +=
          document.documentElement.scrollHeight -
          document.documentElement.clientHeight;
      }
      popup.classList.add("rubychan-popup-top");
      popup.style.bottom = y + "px";
    }

    return popup;
  },
  closePopup: function () {
    var popups = document.querySelectorAll(".rubychan-popup");
    for (var i = 0, len = popups.length; i < len; i++) {
      popups[i].remove();
    }
  },
  getSelection: function () {
    var sel = window.getSelection();
    if (sel.rangeCount < 1 || sel.isCollapsed || sel.toString().trim() == "") {
      return null;
    }
    var selRange = sel.getRangeAt(0);
    var selectionClientRects = selRange.getClientRects();
    var selectionClientRect = selectionClientRects[0];
    if (
      selectionClientRect == null ||
      selectionClientRect.width == 0 ||
      selectionClientRect.height == 0
    ) {
      return null;
    }

    var selectionText = sel.toString();
    var clientRects = new Array();
    var maxWidth = 0;
    for (var i = 0; i < selectionClientRects.length; i++) {
      var item = selectionClientRects[i];
      if (item.width > 0 && item.height > 0) {
        maxWidth = Math.max(item.width, maxWidth);
        clientRects.push(item);
      }
    }
    if (clientRects.length == 0) {
      return null;
    }

    var first = clientRects[0];
    var last = clientRects[clientRects.length - 1];
    var top = first.top;
    var right = first.right;
    var bottom = last.bottom;
    var left = last.left;
    var width = maxWidth;
    if (maxWidth == 0) {
      width = Math.abs(right - left);
    }

    if (clientRects.length > 1) {
      if (first.left > last.left) {
        return {
          top: top,
          right: right,
          bottom: bottom,
          left: first.left,
          width: right - first.left,
          maxWidth: maxWidth,
          selectionText: selectionText,
        };
      } else if (last.right < first.right) {
        return {
          top: top,
          right: first.right,
          bottom: bottom,
          left: left,
          width: first.right - left,
          maxWidth: maxWidth,
          selectionText: selectionText,
        };
      }
    }
    return {
      top: top,
      right: right,
      bottom: bottom,
      left: left,
      width: width,
      maxWidth: maxWidth,
      selectionText: selectionText,
    };
  },

  onOutsideClick: function (event) {
    const popups = document.querySelectorAll(".rubychan-popup");
    if (popups.length > 0) {
      const clickedInside = Array.from(popups).some(
        (popup) => popup.contains(event.target) || popup === event.target
      );

      if (!clickedInside) {
        RubyContentBundle.closePopup();
      }
    }
  },
};

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  switch (request.type) {
    case "enableRubychan":
      RubyContentBundle.enable();
      break;
    case "disableRubychan":
      RubyContentBundle.disable();
      break;
    case "updatedDefinitions":
    case "updateDefinitions":
      var definitionsContainer = document.getElementById(
        "rubychan-definitions-container"
      );
      if (definitionsContainer) {
        definitionsContainer.innerHTML =
          request.definitions ||
          '<div class="rubychan-loading">No definitions found</div>';

        document
          .querySelectorAll(".rubychan-audio-button")
          .forEach(function (button) {
            button.addEventListener("click", function (e) {
              const word = button.getAttribute("data-word");
              if (word && !button.disabled) {
                button.disabled = true;
                button.classList.add("rubychan-audio-playing");

                speechSynthesis.cancel();

                const utterance = new SpeechSynthesisUtterance(word);
                utterance.lang = "ja-JP";

                utterance.onend = function () {
                  button.disabled = false;
                  button.classList.remove("rubychan-audio-playing");
                };

                utterance.onerror = function () {
                  button.disabled = false;
                  button.classList.remove("rubychan-audio-playing");
                };

                speechSynthesis.speak(utterance);

                e.preventDefault();
                e.stopPropagation();
              }
            });
          });
      }
      break;
    default:
  }
});

chrome.runtime.sendMessage({
  type: "checkEnabled",
});
