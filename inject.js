"use strict";

/* Trello Super Powers add-on

This script initializes these 3 features:
1. copy card id on click
2. compact mode
3. resizable lists
*/
// What is this? --> browser.extensionTypes.RunAt = "document_end";

var TSP = {
	init() {
		var copyIdFeature = new Promise(function(resolve, reject) {
			let input = document.createElement('input');
			// Add dummy element so we can use the clipboard function
			document.getElementsByTagName('body')[0].appendChild(input);

			document.addEventListener('click', function(e) {
        			if(e.target.classList.contains('card-short-id')) {
					e.stopImmediatePropagation();
					e.preventDefault();

					input.value = e.target.textContent;
					input.select();

					document.execCommand('copy');
					console.info("Copied!");
				}
			}, true);
			resolve();
		});
		var compactModeFeature = new Promise(function(resolve, reject) {
			let compactModeBtn = document.createElement('a');

			compactModeBtn.setAttribute('class', 'board-header-btn compact-mode-button');
			compactModeBtn.setAttribute('title', 'Toggle Compact Mode');

			{
				let inner = document.createElement('span');

				inner.setAttribute('class', 'board-header-btn-text');
				inner.textContent = "Compact Mode";

				compactModeBtn.appendChild(inner);
			}

			compactModeBtn.addEventListener('click', function toggleCompactMode() {
				// Toggle compactMode
				document.getElementsByTagName('body')[0].classList.toggle('compact-mode');
			});

			document.getElementById('permission-level').parentElement.appendChild(compactModeBtn);

			resolve();
		});
		var resizableListsFeature = new Promise(function(resolve, reject) {
			function createResizeElem() {
				let resizeElem = document.createElement('div');

				resizeElem.setAttribute("class", "resize-element list-wrapper");
				resizeElem.addEventListener("mousedown", function (e) {
					document.addEventListener("mousemove", attach);
					document.addEventListener("mouseup", remove);

					function attach(e) {
						let styleId = document.getElementById("inserted-tsp-styles");
						styleId.textContent=`.list-wrapper {width: ${TSP.listWidth=TSP.listWidth+(e.movementX / 4)}px}`;
						console.info(e.movementX);
					}
					function remove(e) {
						//TODO: Save width to browser and apply it when page is reloaded

						document.removeEventListener("mousemove", attach);
						document.removeEventListener("mouseup", remove);
					}
				});

				return resizeElem;
			}

			{
			  let styleElem = document.getElementsByTagName("head")[0].appendChild(document.createElement("style"));

			  styleElem.textContent = `.list-wrapper {width: ${TSP.listWidth}px}`;
			  styleElem = styleElem.setAttribute("id", "inserted-tsp-styles");
			}


			var lists = [];

			document.getElementById("board").childNodes.forEach(function(listReference, i) {
				lists[i] = listReference;
			});

			for (let i = 1; i < lists.length; i++) {

				let resizeElem = createResizeElem();

				lists[i].parentElement.insertBefore(resizeElem, lists[i]);
			}

			resolve();
		});

		Promise.all([
			copyIdFeature,
			compactModeFeature,
			resizableListsFeature
		]).then(function success() {console.log("Initialized successfully")}, function failure(e) {console.log(":(", e)})
	},
	listWidth: browser.storage.sync.get("listWidth").then(function(result) {return result;}, function(errMsg) {TSP.listWidth = TSP.defaultListWidth;}) || TSP.defaultListWidth,
	defaultListWidth: 270
};

TSP.init();
