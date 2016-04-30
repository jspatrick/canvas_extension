var canvasext = {};

canvasext.parse = (function(){
	var configMap = {

		//Class to use to search for divs with module links
		module_class: ".item-group-condensed",
		module_item_class: ".module-item-title",
		module_title_selector: "span .name",
		downloadable_item_types: new Array("Attachment", "Wiki Page", "External Url"),
		file_id_regexp: new RegExp(".*/modules/items/([0-9]+)/?")
	};
	
	var jqueryMap = {};
	var stateMap = {
		fileIDs: {},
		fileTiles: {},
		fileTypes: {}
	};

	//Get all the canvas module links on the page

	function makeModuleFileMap(){
		var modules = $(configMap.module_class);
		var moduleItemTitles = $(configMap.module_item_class);
		stateMap.fileIDs = {};
		stateMap.fileTitles = {};
		stateMap.fileTypes = {};
		//loop through each module
		modules.each(function(idx, elem){
			
			$moduleDiv = $(elem);
			//If the module is hidden, skip it
			if ($moduleDiv.css("display") == "none") return;

			//Get the name of the module
			moduleName = $moduleDiv.find(configMap.module_title_selector).html();
			stateMap.fileIDs[moduleName] = new Array();

			$moduleItems = $moduleDiv.find(configMap.module_item_class);
			
			$moduleItems.each(function(idx, elem){
				var $item = $(elem);
				var $type_icon = $item.find(".type_icon");

				if (configMap.downloadable_item_types.indexOf($type_icon.attr("title")) >= 0){
					var $link = $item.find("a");
					var ref = $link.attr("href");
					var title = $link.html();
					var filetype = $type_icon.attr("title");
					var fileId = "";
					if (filetype === "Attachment" || filetype == "Wiki Page"){
						var fileId = configMap.file_id_regexp.exec(ref)[1];
					} else {
						var fileId = ref;
					}
					stateMap.fileTypes[fileId] = $type_icon.attr("title");
					stateMap.fileIDs[moduleName].push(fileId);
					stateMap.fileTitles[fileId] = title;
					
				}
				
			});
		});
		
	}


	function initModule(){
		console.log("Initializing Canvasext Content Script");
		makeModuleFileMap();
		console.log(stateMap.fileIDs);

		//get the course title
		var courseTitle = $("#section-tabs-header").text().trim();
		
		chrome.runtime.onMessage.addListener(
			function(request, sender, sendResponse){
				console.log("Got message:");
				console.log(request);
				if (request.type == "getFileIDs"){
					console.log("Sending File IDs: ", stateMap);
					sendResponse({"fileIDs": stateMap.fileIDs,
								  "fileTitles": stateMap.fileTitles,
								  "fileTypes": stateMap.fileTypes,
								  "courseTitle": courseTitle});
				}
			});

	}
	
	return {initModule: initModule,
			stateMap: stateMap};
})();

$(document).ready(canvasext.parse.initModule());


