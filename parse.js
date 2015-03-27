var canvasext = {};

canvasext.parse = (function(){
	var configMap = {

		link_html: String() + 
			'<div class="link-section">' +
			'<input id="link-checkbox" type="checkbox">'+ 
			'<a href="#" class="link-title">Link</a>' +
			'</div>',

		//Class to use to search for divs with module links
		module_class: ".item-group-condensed",
		module_item_class: ".module-item-title",
		module_title_selector: "span .name",
		file_id_regexp: new RegExp(".*/modules/items/([0-9]+)/?"),
		link_extension: "/file"
	};
	
	var jqueryMap = {};
	var stateMap = {};

	//Get all the canvas module links on the page

	function makeModuleFileMap(){
		var modules = $(configMap.module_class);
		var moduleItemTitles = $(configMap.module_item_class);
		stateMap.fileIDs = {};
		
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
				if ($type_icon.attr("title") == "Attachment"){			
					var $link = $item.find("a");
					var ref = $link.attr("href");
					console.log(ref);
					//the ref is the link to the page that displays the file.  Each file has an "id", 
					//which is part of the url.  Get the file ID from the url.
					var fileId = configMap.file_id_regexp.exec(ref)[1];
					stateMap.fileIDs[moduleName].push(fileId);
				}
			});
		});
		
	}


	function initModule(){
		console.log("Initializing Canvasext Content Script");
		makeModuleFileMap();
		console.log(stateMap.fileIDs);

		chrome.runtime.onMessage.addListener(
			function(request, sender, sendResponse){
				console.log("Got message:");
				console.log(request);
				if (request.type == "getFileIDs"){
					console.log("Sending File IDs..");
					sendResponse({"fileIDs": stateMap.fileIDs});
				}
			});

	}

	return {initModule: initModule,
			stateMap: stateMap};
})();

$(document).ready(canvasext.parse.initModule());


