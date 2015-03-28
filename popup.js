// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.


var canvasext = {};

canvasext.popup = (function(){
	var configMap = {
		downloadToModuleFolder: true,						  
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
		cboxes = getCheckedItems();

		fileUrls = new Array();
		for (i in cboxes){
			var $cbox = cboxes[i];
			
			var url = stateMap.host + "/" + $cbox.attr('url');			
			var fileTitle = $cbox.attr('title');
			var module = $cbox.attr('module');
			if (configMap.downloadToModuleFolder){
				var savePath = "canvasext/" + fileTitle;
			} else {
				
			}

			console.log("Saving to %s", savePath);
			var shown = false;
			chrome.downloads.download({"url": url,
									   "filename": savePath,
									   "saveAs": false},
									  function(downloadId) {
										  console.log("Downloaded %i", downloadId);
										  if (!shown){
											  chrome.downloads.show(downloadId);
											  shown = true;
										  }
									  });
		
		}
	}


	function handleAllCboxChanged(event){
		var checked = $(event.target).prop("checked");
		for (var moduleName in jqueryMap.moduleCboxes){
			for (i in jqueryMap.moduleCboxes[moduleName]){
				jqueryMap.moduleCboxes[moduleName][i].prop('checked', checked);				
			}
		}
	}

	function createCheckBoxes(moduleIDMap){
		stateMap.moduleIdMap = moduleIDMap;
		//for each module, add the module div
		//for each file, add the checkbox
		jqueryMap.modules = {};
		jqueryMap.moduleCboxes = {};

		var moduleTitle;
		for (moduleTitle in moduleIDMap){
			if (!moduleIDMap.hasOwnProperty(moduleTitle)) continue;
			
			jqueryMap.moduleCboxes[moduleTitle] = new Array();

			fileIDs = moduleIDMap[moduleTitle];
			$moduleDiv = $(configMap.module_section_html);
			$moduleDiv.find(".module-title").html(moduleTitle);
			$moduleCheckboxContainer = $moduleDiv.find(".module-file-container");
			
			
			for (i in fileIDs){
				//Create a closure around some variables since the ajax call is async
				function setupCheckbox(fileID, moduleTitle, $moduleCheckboxContainer){
					function result (){
						
						itemUrl = stateMap.host + "/courses/" + stateMap.course_id + "/modules/items/" + fileID;

						$.ajax({
							type: 'GET',
							url: itemUrl,
							success: function(data, textStatus, xhr){
								var $downloadItem = $(configMap.item_html);
								var $downloadCbox = $downloadItem.find("input");
								$downloadCbox.attr("module", moduleTitle);

								var link = $(data).find("#content").find("a")[0];
								//TODO: Handle this more gracefully - display an uncheckable item
								var linkError = false;
								if (!link){
									console.log("Error: Cannot find link from %s",itemUrl);
									linkError = true;
									

								} else {
									var linkUrl = link.attributes["href"].value;
									var linkTitle = link.text;
									linkTitle = linkTitle.replace(RegExp("^Download ?"),""); 
									$downloadItem.find(".download-title").html(linkTitle);
									$downloadCbox.attr("url", linkUrl);
									$downloadCbox.attr("title", linkTitle);
									$moduleCheckboxContainer.append($downloadItem);
									jqueryMap.moduleCboxes[moduleTitle].push($downloadCbox);
								}
								//strip the "Download " prefix off the title
								
							},
							error: function(jqXHR, textStatus, errorThrown){
								console.log("Error getting download from %s", url);
							}
						});
					}
					return result;
				};

				var fileID = fileIDs[i];
				setupCheckbox(fileID, moduleTitle, $moduleCheckboxContainer)();
			}

			jqueryMap.$moduleContainer.append($moduleDiv);
			jqueryMap.modules[moduleTitle] = $moduleDiv;
		}
		console.log(Object.keys(stateMap.moduleIdMap));
	}


	function getCheckedItems(){
		var result = new Array();
		for (moduleTitle in jqueryMap.moduleCboxes){
			for (i in jqueryMap.moduleCboxes[moduleTitle]){
				var $cbox = jqueryMap.moduleCboxes[moduleTitle][i];
				
				if ($cbox.prop("checked")){
					result.push($cbox);
				}
			}
		}
		return result;
	}


	function checkAllItems(){
	}


	function setJqueryMap(){
		jqueryMap.$moduleContainer = $("#modules");
		jqueryMap.$statusBar = $("#statusbar");
		jqueryMap.$header = $("#head");
		jqueryMap.$downloadAllCbox = $("#download-all-cbox");
		jqueryMap.$downloadBtn = $("#download-btn");
		jqueryMap.$downloadIframe = $("#download-iframe");
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
