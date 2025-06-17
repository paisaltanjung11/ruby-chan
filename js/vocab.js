document.addEventListener("DOMContentLoaded", function () {
  loadVocabulary();

  document
    .getElementById("export-button")
    .addEventListener("click", exportVocabulary);
  document
    .getElementById("delete-all-button")
    .addEventListener("click", deleteAllVocabulary);
});

// Load vocabulary from chrome.storage
function loadVocabulary() {
  chrome.storage.local.get("rubychanVocab", function (result) {
    const vocab = result.rubychanVocab || [];
    renderVocabularyTable(vocab);
  });
}

function renderVocabularyTable(vocab) {
  const vocabList = document.getElementById("vocab-list");
  const emptyMessage = document.getElementById("empty-message");
  const vocabTable = document.getElementById("vocab-table");

  vocabList.innerHTML = "";

  if (vocab.length === 0) {
    emptyMessage.style.display = "block";
    vocabTable.style.display = "none";
    return;
  }

  emptyMessage.style.display = "none";
  vocabTable.style.display = "table";

  vocab.sort((a, b) => a.word.localeCompare(b.word));

  // Add vocabulary items
  vocab.forEach((item, index) => {
    const row = document.createElement("tr");

    const wordCell = document.createElement("td");
    wordCell.textContent = item.word;
    row.appendChild(wordCell);

    const readingCell = document.createElement("td");
    readingCell.textContent = item.reading || "";
    row.appendChild(readingCell);

    const meaningCell = document.createElement("td");
    meaningCell.textContent = item.meaning || "";
    row.appendChild(meaningCell);

    const actionsCell = document.createElement("td");
    actionsCell.className = "rubychan-vocab-action";

    const speakButton = document.createElement("button");
    speakButton.className = "rubychan-vocab-speak";
    speakButton.innerHTML = "🔊";
    speakButton.title = "Speak";
    speakButton.addEventListener("click", function () {
      speakWord(item.word);
    });
    actionsCell.appendChild(speakButton);

    const deleteButton = document.createElement("button");
    deleteButton.className = "rubychan-vocab-delete";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", function () {
      deleteVocabularyItem(index);
    });
    actionsCell.appendChild(deleteButton);

    row.appendChild(actionsCell);

    vocabList.appendChild(row);
  });
}

function speakWord(word) {
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "ja-JP";
    speechSynthesis.speak(utterance);
  } else {
    alert("Sorry, your browser does not support text to speech!");
  }
}

function deleteVocabularyItem(index) {
  if (confirm("Are you sure you want to delete this vocabulary item?")) {
    chrome.storage.local.get("rubychanVocab", function (result) {
      let vocab = result.rubychanVocab || [];

      if (index >= 0 && index < vocab.length) {
        vocab.splice(index, 1);

        chrome.storage.local.set(
          {
            rubychanVocab: vocab,
          },
          function () {
            renderVocabularyTable(vocab);
          }
        );
      }
    });
  }
}

function deleteAllVocabulary() {
  if (
    confirm(
      "Are you sure you want to delete all vocabulary items? This action cannot be undone."
    )
  ) {
    chrome.storage.local.set(
      {
        rubychanVocab: [],
      },
      function () {
        renderVocabularyTable([]);
      }
    );
  }
}

function exportVocabulary() {
  chrome.storage.local.get("rubychanVocab", function (result) {
    const vocab = result.rubychanVocab || [];

    if (vocab.length === 0) {
      alert("No vocabulary items to export.");
      return;
    }

    let csvContent = "Word,Reading,Meaning\n";

    vocab.forEach(function (item) {
      const word = item.word ? `"${item.word.replace(/"/g, '""')}"` : "";
      const reading = item.reading
        ? `"${item.reading.replace(/"/g, '""')}"`
        : "";
      const meaning = item.meaning
        ? `"${item.meaning.replace(/"/g, '""')}"`
        : "";

      csvContent += `${word},${reading},${meaning}\n`;
    });

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "rubychan_vocabulary.csv");
    document.body.appendChild(link);

    link.click();
    document.body.removeChild(link);
  });
}
