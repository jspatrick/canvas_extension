// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
var canvasext = {};

canvasext.popup = (function(){
	var configMap = {
		course_regex: new RegExp("/?courses/([0-9]+)/.*"),
		module_section_html: String() + 
			'<div class="module">' + 
			'  <div class="module-title">' + 
			'The Module Title' + 
			'  </div>' +
			'  <div class="module-file-container">' + 
			'  </div>' +
			'</div>\n',

		item_html: String() + 
			'		<div class="download">' + 
			'		  <input class="download-checkbox" type="checkbox"></input>' +
			'		  <span class="download-title">The Link to download</span>' +
			'		</div>'
	};

	//Tracks jquery objects on the page
	var jqueryMap = {
		download_items: {}
	}; 

	//Tracks various other states on the page.
	var stateMap = {
		host: "https://courses.gsb.stanford.edu" // placeholder.  Should be replaced by code to get it
	};

	/*
	 Set the page to be in a "loading" or "ready" state
	 @param status: true if loading, else false
	 @type status: bool
	*/
	function setLoadingStatus(status){
		if (status) {
			jqueryMap.$statusBar.addClass("loading");
			jqueryMap.$statusBar.html("Loading...");
		} else {
			jqueryMap.$statusBar.html("Ready");
			jqueryMap.$statusBar.removeClass("loading");
		}
	}

	/*
	 Download the selected modules
	 
	 */
	function handleDownloadButtonClick(event){
		console.log("Downloading...");
		console.log(event);
		//get all checked items
		//get urls for checked items.
		//start downloads
	}

	function handleAllCboxChanged(event){
		console.log("Changing...");
		console.log(event);
		
		for (var moduleName in jqueryMap.moduleCboxes){
			for (i in jqueryMap.moduleCboxes[moduleName]){
				jqueryMap.moduleCboxes[moduleName][i].attr("checked", true);
				
				
			}
		}
		
	}

	function createCheckBoxes(moduleIDMap){
		stateMap.moduleIdMap = moduleIDMap;
		//for each module, add the module div
		//for each file, add the checkbox
		jqueryMap.modules = {};
		jqueryMap.moduleCboxes = {};

		for (moduleTitle in moduleIDMap){
			if (!moduleIDMap.hasOwnProperty(moduleTitle)) continue;
			
			jqueryMap.moduleCboxes[moduleTitle] = {};

			fileIDs = moduleIDMap[moduleTitle];
			$moduleDiv = $(configMap.module_section_html);
			$moduleDiv.find(".module-title").html(moduleTitle);
			$moduleCheckboxContainer = $moduleDiv.find(".module-file-container");
			
			
			for (i in fileIDs){
				var checkedIDs = 0;
				
				
				function setupCheckbox(fileID, $moduleCheckboxContainer){
					function result (){
						
						itemUrl = stateMap.host + "/courses/" + stateMap.course_id + "/modules/items/" + fileID;

						$.ajax({
							type: 'GET',
							url: itemUrl,
							success: function(data, textStatus, xhr){
								var link = $(data).find("#content").find("a")[0];
								var linkUrl = link.attributes["href"].value;
								var linkTitle = link.text;

								//strip the "Download " prefix off the title
								linkTitle = linkTitle.replace(RegExp("^Download ?"),""); 

								var $downloadItem = $(configMap.item_html);
								$downloadItem.find(".download-title").html(linkTitle);
								$downloadItem.attr("url", linkUrl);
								jqueryMap.download_items[fileID] = $downloadItem;
								$moduleCheckboxContainer.append($downloadItem);
								var $downloadCbox = $downloadItem.find("input");
								jqueryMap.moduleCboxes[moduleTitle].append($downloadCbox);
						
							},
							error: function(jqXHR, textStatus, errorThrown){
								console.log("Error getting download from %s", url);
								checkedIDs += 1;
							}
						});
					}
					return result;
				};

				var fileID = fileIDs[i];
				setupCheckbox(fileID, $moduleCheckboxContainer)();
			}

			jqueryMap.$moduleContainer.append($moduleDiv);
			jqueryMap.modules[moduleTitle] = $moduleDiv;
		}
		console.log(Object.keys(stateMap.moduleIdMap));
	}

	function setJqueryMap(){
		jqueryMap.$moduleContainer = $("#modules");
		jqueryMap.$statusBar = $("#statusbar");
		jqueryMap.$header = $("#head");
		jqueryMap.$downloadAllCbox = $("#download-all-cbox");
		jqueryMap.$downloadBtn = $("#download-btn");
	}

	//if no files are available, display it in the page
	function setNoFilesAvailable(){
		jqueryMap.$moduleContainer.html("");
		jqueryMap.$statusBar.html("No Files Available");
		jqueryMap.$header.addClass("hidden");
	}

	function initModule(){
		setJqueryMap();
		setLoadingStatus(true);

		//setup event handlers
		jqueryMap.$downloadBtn.click(handleDownloadButtonClick);
		jqueryMap.$downloadAllCbox.change(handleAllCboxChanged);
		//Ask for all the module URLS from the page
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			stateMap.current_tab = tabs[0];

			chrome.tabs.sendMessage(tabs[0].id, {type: "getFileIDs"}, function(response){

				if (response && response.fileIDs){
					stateMap.fileIDs = response.fileIDs;
					console.log(response.fileIDs);
					stateMap.course_id = configMap.course_regex.exec(tabs[0].url)[1];
					createCheckBoxes(response.fileIDs);
				} else {
					setNoFilesAvailable();
				}
			});
		});

	}


	return {
		"initModule": initModule,
		"stateMap": stateMap,
		"jqueryMap": jqueryMap
	};
})();



$(document).ready(canvasext.popup.initModule);
