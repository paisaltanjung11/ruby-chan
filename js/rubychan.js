importScripts("../lib/kuromoji/kuromoji.js");

var DIC_URL = "../lib/kuromoji/dict/";
var tokenizer = null; // Global tokenizer
var isTokenizerInitializing = false; // track initialization status
var definitionCache = new Map();
const CACHE_EXPIRY_DAYS = 1;

var RubyChanMain = {
  enabled: false,
  tokenizer: null,

  init: function () {
    this.initializeTokenizer();

    this.loadDefinitionCache();

    chrome.storage.local.get("rubychanEnabled", function (value) {
      RubyChanMain.enabled = value.rubychanEnabled;
      if (RubyChanMain.enabled === undefined) {
        RubyChanMain.enabled = true;
      }
      chrome.storage.local.set(
        {
          rubychanEnabled: RubyChanMain.enabled,
        },
        function () {}
      );
    });
  },

  loadDefinitionCache: function () {
    chrome.storage.local.get("definitionCache", function (data) {
      if (data.definitionCache) {
        try {
          const cachedData = JSON.parse(data.definitionCache);
          const now = new Date().getTime();

          if (
            cachedData.timestamp &&
            now - cachedData.timestamp < CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
          ) {
            Object.entries(cachedData.definitions).forEach(([key, value]) => {
              definitionCache.set(key, value);
            });
            console.log(
              `✅ Loaded ${definitionCache.size} definitions from cache`
            );
          } else {
            console.log("Cache expired, creating new cache");
            RubyChanMain.saveDefinitionCache();
          }
        } catch (error) {
          console.error("Error parsing cache:", error);
          RubyChanMain.saveDefinitionCache();
        }
      }
    });
  },

  saveDefinitionCache: function () {
    const cacheObj = {
      timestamp: new Date().getTime(),
      definitions: Object.fromEntries(definitionCache),
    };

    chrome.storage.local.set(
      {
        definitionCache: JSON.stringify(cacheObj),
      },
      function () {
        console.log(`✅ Saved ${definitionCache.size} definitions to cache`);
      }
    );
  },

  initializeTokenizer: function () {
    if (tokenizer !== null || isTokenizerInitializing) {
      return;
    }

    isTokenizerInitializing = true;
    console.log("Initializing tokenizer with dictionary path:", DIC_URL);

    kuromoji
      .builder({
        dicPath: DIC_URL,
      })
      .build(function (error, _tokenizer) {
        if (error != null) {
          console.error("Tokenizer initialization error:", error);
          isTokenizerInitializing = false;
          setTimeout(() => {
            RubyChanMain.initializeTokenizer();
          }, 2000);
        } else {
          console.log("Tokenizer initialized successfully");
          tokenizer = _tokenizer;
          isTokenizerInitializing = false;
        }
      });
  },

  onClicked: function (tab) {
    RubyChanMain.enabled = !RubyChanMain.enabled;
    chrome.storage.local.set(
      {
        rubychanEnabled: RubyChanMain.enabled,
      },
      function () {}
    );
    RubyChanMain.sendEnabled(tab.id);
  },
  onSelectionChanged: function (tab) {
    RubyChanMain.sendEnabled(tab.tabId);
  },
  sendEnabled: function (tabId) {
    if (RubyChanMain.enabled) {
      chrome.tabs.sendMessage(tabId, {
        type: "enableRubychan",
      });
    } else {
      chrome.tabs.sendMessage(tabId, {
        type: "disableRubychan",
      });
    }
  },

  getDefinitionFromJisho: async function (word) {
    if (definitionCache.has(word)) {
      console.log(`✅ Found in cache: ${word}`);
      return definitionCache.get(word);
    }

    try {
      console.log(`⏳ Fetching definition for: ${word}`);
      const res = await fetch(
        `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(
          word
        )}`,
        {
          cache: "force-cache",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const entry = data.data[0];
        const result = {
          reading: entry.japanese?.[0]?.reading || "",
          definitions:
            entry.senses?.[0]?.english_definitions.join(", ") ||
            "No definition available",
        };

        definitionCache.set(word, result);
        console.log(`✅ Definition for "${word}":`, result);

        if (definitionCache.size % 10 === 0) {
          this.saveDefinitionCache();
        }

        return result;
      } else {
        console.log(`⚠️ No definition found for: ${word}`);
        const emptyResult = {
          reading: "",
          definitions: "No definition available",
        };
        definitionCache.set(word, emptyResult);
        return emptyResult;
      }
    } catch (error) {
      console.error(`❌ Error fetching definition for ${word}:`, error);
      return { reading: "", definitions: `Error: ${error.message}` };
    }
  },

  getFurigana: function (text, sendResponse) {
    if (tokenizer === null) {
      if (!isTokenizerInitializing) {
        this.initializeTokenizer();
      }

      sendResponse({
        furigana: text,
        waitingForTokenizer: true,
      });
      return;
    }

    var resultHtml = "";
    var definitionsHtml = "";
    var processedWords = new Set();

    if (text == null || text == "") {
      sendResponse();
      return;
    }

    let hasResponse = false;
    try {
      text.split(/\r\n|\r|\n/).forEach(function (v, i) {
        if (resultHtml != "") {
          resultHtml += "<br>";
        }
        if (v == null || v.trim() == "") {
          return;
        }
        var tokens = tokenizer.tokenize(v);

        for (let i = 0; i < tokens.length; i++) {
          let token = tokens[i];
          let surfaceForm = token.surface_form;
          let reading = token.reading;
          let basicForm = token.basic_form || surfaceForm;

          if (surfaceForm == null || surfaceForm == "") {
            continue;
          }
          if (reading != null && reading.trim() != "") {
            var note = kana2Hira(reading);
            var text = kana2Hira(surfaceForm);
            if (note != text) {
              var start = 0;
              while (note && text && note[start] == text[start]) {
                start += 1;
              }
              resultHtml += surfaceForm.substr(0, start);
              surfaceForm = surfaceForm.substr(start);
              note = note.substr(start);

              if (note && text) {
                resultHtml +=
                  "<ruby><rb>" +
                  surfaceForm +
                  "</rb><rp>(</rp><rt>&nbsp;" +
                  note +
                  "&nbsp;</rt><rp>)</rp></ruby>";

                if (
                  !processedWords.has(basicForm) &&
                  token.pos !== "助詞" &&
                  token.pos !== "助動詞" &&
                  token.pos !== "記号" &&
                  token.pos !== "その他"
                ) {
                  processedWords.add(basicForm);
                }

                hasResponse = true;
                continue;
              }
            }
          }
          resultHtml += surfaceForm;
        }
      });

      // Send the furigana response first
      if (hasResponse) {
        sendResponse({
          furigana: resultHtml,
        });

        // Then process and send definitions
        Promise.all(
          Array.from(processedWords).map((word) =>
            RubyChanMain.getDefinitionFromJisho(word).then((definition) => {
              return { word: word, definition: definition };
            })
          )
        )
          .then((definitions) => {
            definitionsHtml = '<div class="rubychan-definitions">';
            definitions.forEach((item) => {
              if (
                item.definition &&
                item.definition.definitions !== "No definition available"
              ) {
                definitionsHtml += `<div class="rubychan-definition-item">
                      <div class="rubychan-word">${item.word}
                      <button class="rubychan-audio-button" title="Play pronunciation" aria-label="Play pronunciation of ${
                        item.word
                      }" data-word="${item.word}">🔊</button></div>
                      <div class="rubychan-reading">${
                        item.definition.reading || ""
                      }</div>
                      <div class="rubychan-meaning">${
                        item.definition.definitions
                      }</div>
                  </div>`;
              } else {
                definitionsHtml += `<div class="rubychan-definition-item">
                      <div class="rubychan-word">${item.word}</div>
                      <div class="rubychan-meaning">No definition found</div>
                  </div>`;
              }
            });
            definitionsHtml += "</div>";

            chrome.tabs.query(
              { active: true, currentWindow: true },
              function (tabs) {
                if (tabs.length > 0) {
                  chrome.tabs.sendMessage(tabs[0].id, {
                    type: "updateDefinitions",
                    definitions: definitionsHtml,
                  });
                }
              }
            );
          })
          .catch((error) => {
            console.error("Error processing definitions:", error);
          });
      } else {
        sendResponse({
          furigana: text,
        });
      }
    } catch (error) {
      console.error("Error processing text:", error);
      sendResponse({
        furigana: text,
        error: error.message,
      });
    }
  },
};

function kana2Hira(str) {
  return str.replace(/[\u30a1-\u30f6]/g, function (match) {
    var chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

RubyChanMain.init();
