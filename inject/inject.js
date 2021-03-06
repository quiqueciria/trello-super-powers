"use strict";

/*
Inizialize Trello Super Powers features
- copy card id on click
- compact mode
- resizable lists
- label text
- number of cards per list
*/

function gracefullyInject(feature) {
  /** Takes a funtion and injects it
   * TODO: add error handling logic
   */
  feature();
}

/**
 * Wrapper for `browser.storage.local.get()`.
 *
 * @returns {object} An object with current settings.
 */
async function getSettings() {
  return await browser.storage.local.get();
}

// NOTE: Ideally in the future, each feature has its own module
var features = {
  /**
   * Initializes ID feature.
   *
   * @returns {promise}
   */
  id() {
    return new Promise(function(resolve, reject) {
      let input = document.createElement("input");

      // Add dummy element so we can use the clipboard functionality
      document.getElementsByTagName("body")[0].appendChild(input);

      document.addEventListener("click", copyCardURL, true);
      function copyCardURL(e) {
        // Don't move on if the element clicked is not an ID
        if (!e.target.classList.contains("card-short-id")) return;

        let elem;

        e.stopImmediatePropagation();
        e.preventDefault();

        elem = e.target;
        // Traverse up the DOM to find the anchor element with the URL we want to copy.
        while (true) {
          elem = elem.parentNode;

          if (elem.tagName !== "A") continue;

          input.value = elem.href;
          input.select();
          document.execCommand("copy");
          break;
        }

        // NOTE: Content Scripts do not have access to the notifications API. If a notification should be sent, we have to communicate with the background script using the messaging API
        browser.runtime.sendMessage({
          type: "notification",
          message: browser.i18n.getMessage("injectIdNotificationBody")
        });
      }

      console.info("TSP: feature 'id' injected");
      board.classList.add("TSP-id-enabled");
      resolve();
    });
  },
  /**
   * Initializes Compact Mode feature
   *
   * @returns {promise}
   */
  compact() {
    return new Promise(async function(resolve, reject) {
      function createCompactModeButton() {
        let parent, child;

        parent = document.createElement("a");
        parent.setAttribute("class", "board-header-btn compact-mode-button");
        // TODO: Internationalize this string!
        parent.setAttribute("title", "Toggle Compact Mode");

        child = document.createElement("span");
        // Apply Trello button class. NOTE: Provided by Trello itself
        child.setAttribute("class", "board-header-btn-text");
        child.textContent = browser.i18n.getMessage("settingsCompactTitle");

        parent.appendChild(child);

        return parent;
      }

      function toggleCompactMode() {
        // Apply Compact Mode CSS
        board.classList.toggle("compact-mode");
      }

      let compactModeButton = createCompactModeButton();

      compactModeButton.addEventListener("click", toggleCompactMode);

      // Inject into page
      document
        .getElementById("permission-level")
        .parentElement.appendChild(compactModeButton);

      console.info("TSP: feature 'compact' injected");
      board.classList.add("TSP-compact-enabled");
      resolve();
    });
  },
  /**
   * Initializes Resizable Lists feature
   *
   * @returns {promise}
   */
  resize() {
    return new Promise(async function(resolve, reject) {
      function createResizeElem() {
        function attachListeners() {
          document.addEventListener("mousemove", adjustSize);
          document.addEventListener("mouseup", setSize);
        }

        function adjustSize(e) {
          let styleId = document.getElementById("inserted-tsp-styles"),
            currentWidth =
              listWidth + e.movementX / 4 < 400 &&
              listWidth + e.movementX / 4 > 150
                ? (listWidth = listWidth + e.movementX / 4)
                : listWidth;

          styleId.textContent = `.list-wrapper {width: ${currentWidth}px}`;
        }

        function setSize(e) {
          document.removeEventListener("mousemove", adjustSize);
          document.removeEventListener("mouseup", setSize);

          browser.storage.local.set({ list: { width: listWidth } }).catch(e => {
            console.error(
              "TSP: Could not save 'listWidth' to browser sync storage.",
              e
            );
          });
        }

        let resizeElem = document.createElement("div");

        resizeElem.setAttribute("class", "resize-element");
        // Listen for mouse down
        resizeElem.addEventListener("mousedown", attachListeners);

        return resizeElem;
      }

      var listWidth,
        lists = [];

      try {
        listWidth = (await browser.storage.local.get()).list.width;
      } catch (e) {
        console.error("TSP Error: Could not get local storage", e);
        listWidth = 270;
      }

      // Insert a <style> element in the <head> if not already created
      if (!document.getElementById("inserted-tsp-styles")) {
        let styleElem = document
          .getElementsByTagName("head")[0]
          .appendChild(document.createElement("style"));

        styleElem.textContent = `.list-wrapper {width: ${listWidth}px}`;
        styleElem.setAttribute("id", "inserted-tsp-styles");
      }

      // Make an array and put get references for the Trello lists
      document
        .getElementById("board")
        .childNodes.forEach((listReference, i) => {
          lists[i] = listReference;
        });

      // Cycle through the Trello lists in the DOM and append resize element after each
      for (let i = 1; i < lists.length; i++) {
        let resizeElem = createResizeElem();
        lists[i].parentElement.insertBefore(resizeElem, lists[i]);
      }

      console.log("TSP: feature 'resize' enabled");
      resolve();
    });
  },
  /**
   * Initializes visible label text feature
   */
  label() {
    // CSS only feature
    console.info("TSP: feature 'label' injected");
    board.classList.add("TSP-label-enabled");
  },
  /**
   * Initializes number of cards feature
   */
  numberOfCards() {
    // CSS only feature
    console.info("TSP: feature 'numberOfCards' injected");
    board.classList.add("TSP-numberOfCards-enabled");
  }
};

/**
 * Initialize and inject all features.
 */
async function initializeFeatures() {
  // Already injected
  if (document.getElementById("TSP-init")) return;

  // Trello board not yet ready
  if (!board) return;

  let settings = await getSettings();

  // IDEA: Maybe a loop that iterates the 'features' object would be even easier
  if (settings.copyId) gracefullyInject(features.id);
  if (settings.compactMode) gracefullyInject(features.compact);
  if (settings.labelText) gracefullyInject(features.label);
  if (settings.numberOfCards) gracefullyInject(features.numberOfCards);
  // Does not have a setting
  gracefullyInject(features.resize);

  let elem = document.createElement("span");
  elem.setAttribute("id", "TSP-init");
  board.appendChild(elem);
}

/**
 * Message handler.
 *
 * @param {object} message Message from the Background Script.
 * @returns {Blob} Containing CSV data.
 */
async function handleMessage(message) {
  /*
    We use PapaParse here, a JSON to CSV library (and vica versa). PapaParse is
    injected by the background script, that is why we can use `Papa` namespace
  */
  if (message.type === "fetch") {
    function formatData(card, i) {
      return {
        name: card.name,
        url: card.url,
        shortUrl: card.shortUrl,
        idShort: card.idShort,
        description: card.desc,
        labels: (() => {
          let labelNames = [];
          for (let j in card.labels) {
            labelNames[j] = card.labels[j].name;
          }
          return labelNames.join(", ");
        })(),
        idList: card.idList,
        idBoard: card.idBoard,
        listName: (() => {
          function matchListId(list) {
            return list.id === card.idList;
          }

          // Find the list that the current card is in
          let list = boardData.lists.find(matchListId);
          return list.name;
        })(),
        due: card.due
      };
    }

    let boardData,
      cardsData,
      { delimiter = ";", includeArchived = false, tabUrl: boardUrl } = message;

    // Fetch JSON from current Trello board
    boardData = await fetch(`${boardUrl}.json`, {
      credentials: "include"
    });
    boardData = await boardData.json();

    // Pick only what we need and put it in `cardsData`
    cardsData = boardData.cards;
    cardsData = cardsData
      .filter(card => (card.closed && includeArchived) || !card.closed)
      .map(formatData);

    try {
      cardsData = await JSON.stringify(cardsData);
      cardsData = Papa.unparse(cardsData, {
        delimiter: delimiter
      });
    } catch (e) {
      console.error("U ERIOUS?", e);
    }

    return new Blob([cardsData], { type: "application/csv" });
  }
}

var board = document.getElementById("board");

browser.runtime.onMessage.addListener(handleMessage);
initializeFeatures();
