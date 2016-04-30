// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var canvasext = {};
console.log("popup reloaded");

//sanitize from https://github.com/parshap/node-sanitize-filename/
canvasext.sanitize = (function(){
	/**
	 * Replaces characters in strings that are illegal/unsafe for filenames.
	 * Unsafe characters are either removed or replaced by a substitute set
	 * in the optional `options` object.
	 *
	 * Illegal Characters on Various Operating Systems
	 * / ? < > \ : * | "
	 * https://kb.acronis.com/content/39790
	 *
	 * Unicode Control codes
	 * C0 0x00-0x1f & C1 (0x80-0x9f)
	 * http://en.wikipedia.org/wiki/C0_and_C1_control_codes
	 *
	 * Reserved filenames on Unix-based systems (".", "..")
	 * Reserved filenames in Windows ("CON", "PRN", "AUX", "NUL", "COM1",
	 * "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", 
	 * "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", and
	 * "LPT9") case-insesitively and with or without filename extensions.
	 *
	 * @param  {String} input   Original filename
	 * @param  {Object} options {replacement: String}
	 * @return {String}         Sanitized filename
	 */

	var illegalRe = /[\/\?\+<>\\:\*\|":]/g;
	var controlRe = /[\x00-\x1f\x80-\x9f]/g;
	//var reservedRe = /^\.+$/;
	var windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

	function sanitize(input, replacement) {
		return input
			.replace(illegalRe, replacement)
			.replace(controlRe, replacement)
			//.replace(reservedRe, replacement)
			.replace(windowsReservedRe, replacement);
	}
	
	return {sanitize: sanitize};

})();


canvasext.popup = (function(){
	var configMap = {
		course_regex: new RegExp("/?courses/([0-9]+)/.*"),
		loading_color: "rgb(255, 195, 102)",
		ready_color: "#aaaaaa",
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
		host: "https://courses.gsb.stanford.edu", // placeholder.  Should be replaced by code to get it
		opening_ids: []
	};

	/*
	 Set the page to be in a "loading" or "ready" state
	 @param status: true if loading, else false
	 @type status: bool
	 */
	function setLoadingStatus(status){
		if (status) {
			jqueryMap.$statusBar.css('background-color', configMap.loading_color);
			jqueryMap.$statusBar.html("Loading...");
		} else {
			jqueryMap.$statusBar.css('background-color', configMap.ready_color);
			jqueryMap.$statusBar.html("Ready");
		}
	}


	/*
	 Download the selected modules
	 */
	
	function handleDownloadButtonClick(event){
		console.log("Downloading...");
		//Setup download change event
		chrome.downloads.onChanged.addListener(function(delta){
			if (!delta.state || delta.state.current != 'complete') 
				return;
			var ids = stateMap.opening_ids;
			if (ids.indexOf(delta.id) < 0) 
				return;
			
			chrome.downloads.show(delta.id);

			ids.splice(ids.indexOf(delta.id),1);
			stateMap.opening_ids = ids;
		});

		cboxes = getCheckedItems();
		var count = cboxes.length;
		fileUrls = new Array();
		downloadErrors = new Array();

		for (i in cboxes){
			var $cbox = cboxes[i];

			var url = $cbox.attr('url');
			var fileTitle = $cbox.attr('title').trim(); //found some files with whitespace after the extension that will cause a save error if untrimmed
			var module = $cbox.attr('module').trim();
			var savePath = "";


			savePath = "canvas_download/"
				+ canvasext.sanitize.sanitize(stateMap.course_title, "-") + "/" 
				+ canvasext.sanitize.sanitize(module, "-") + "/" 
				+ canvasext.sanitize.sanitize(fileTitle, "-");

			
			console.log("Saving to %s", savePath);

			(function (savePath){
				chrome.downloads.download({"url": url,
										   "filename": savePath,
										   "saveAs": false},
										  function(downloadId) {
											  --count;
											  if (!downloadId){
												  console.log("Error downloading %s", savePath);
												  downloadErrors.push(savePath);
												  console.log(chrome.runtime.lastError);
											  }
											  
											  if (count <= 0){
												  console.log("Downloaded %s", savePath);
												  //show the last file
												  stateMap.opening_ids.push(downloadId);
												  //show any errors
												  if (downloadErrors.length){
													  var errStr = "Some files could not be downloaded; please download them manually:\n";
													  errStr += downloadErrors.join("\n");
													  alert(errStr);
												  }
											  }	  
											  
										  });
			}(savePath));
		}
	}


	function handleAllCboxChanged(event){
		var checked = $(event.target).prop("checked");
		for (var moduleName in jqueryMap.moduleCboxes){
			for (i in jqueryMap.moduleCboxes[moduleName]){
				if (jqueryMap.moduleCboxes[moduleName][i].prop('disabled')) continue;

				jqueryMap.moduleCboxes[moduleName][i].prop('checked', checked);				
			}
		}
	}

	function createCheckBoxes(moduleIDMap, idTitleMap, idTypeMap){
		setLoadingStatus(true);
		console.log(moduleIDMap);
		stateMap.moduleIdMap = moduleIDMap;
		stateMap.idTitleMap = idTitleMap;
		stateMap.idTypeMap = idTypeMap;
		//for each module, add the module div
		//for each file, add the checkbox
		jqueryMap.modules = {};
		jqueryMap.moduleCboxes = {};

		var moduleTitle;
		var count = Object.getOwnPropertyNames(idTitleMap).length;
		function updateLoadingStatus(){
			--count;
			if (count < 1){
				setLoadingStatus(false);
			}
		}
		
		console.log("loading modules...");
		for (moduleTitle in moduleIDMap){
			if (!moduleIDMap.hasOwnProperty(moduleTitle)) continue;
			
			jqueryMap.moduleCboxes[moduleTitle] = new Array();

			fileIDs = moduleIDMap[moduleTitle];
			$moduleDiv = $(configMap.module_section_html);
			$moduleDiv.find(".module-title").html(moduleTitle);
			$moduleCheckboxContainer = $moduleDiv.find(".module-file-container");
			
			console.log(fileIDs);
			for (i in fileIDs){
				
				//Create a closure around some variables since the ajax call is async
				(function(fileID, moduleTitle, $moduleCheckboxContainer){
					console.log("Adding %s", fileID);
					var itemUrl = stateMap.host + "/courses/" + stateMap.course_id + "/modules/items/" + fileID;
					var itemType = idTypeMap[fileID];
					
					var $downloadItem = $(configMap.item_html);
					var $downloadCbox = $downloadItem.find("input");
					$downloadCbox.attr("module", moduleTitle);
					$moduleCheckboxContainer.append($downloadItem);
					jqueryMap.moduleCboxes[moduleTitle].push($downloadCbox);
					
					if (itemType == "External Url"){						
						linkUrl = fileID; // Currently using the url as the resource ID
						var linkTitle = stateMap.idTitleMap[fileID];						
						//Some external links are actual files.  Files are directly linked by URL,
						//And we can actually download these						
						if (linkUrl.substr(0,4) == "http"){							
							$downloadCbox.attr("url", linkUrl);
							$downloadCbox.attr("title", linkTitle + ".pdf");
							$downloadItem.find(".download-title").html(linkTitle + ".pdf");							
						} else {							
							$downloadCbox.attr("title", linkTitle + "(Cannot Dowonload External Link)");
							$downloadItem.addClass("download-error");
							$downloadItem.find(".download-title").html(linkTitle + "(Cannot Download External Link)");
							$downloadCbox.attr("disabled", "disabled");							
						}
							updateLoadingStatus();
						
					} else if (itemType == "Attachment"){
						var attachmentRetreive = function(data, textStatus, xhr){

							var link = $(data).find("#content").find("a")[0];
							var linkTitle;

							if (!link){
								console.log("Error: Cannot find link from %s",itemUrl);
								linkUrl = "";
								linkTitle = stateMap.idTitleMap[fileID] + "(Cannot Download)";
								$downloadItem.addClass("download-error");
								$downloadCbox.attr("disabled", "disabled");
							} else {
								var linkUrl = stateMap.host + "/" + link.attributes["href"].value;								
								//Set the link title to the name from the anchor, because it has the extension in it (ie '.pdf')
								linkTitle = link.text.replace(RegExp("^Download ?"), "");
							}

							$downloadItem.find(".download-title").html(linkTitle);
							$downloadCbox.attr("url", linkUrl);
							$downloadCbox.attr("title", linkTitle);

							//strip the "Download " prefix off the title
							updateLoadingStatus();
						};
					
						$.ajax({
							type: 'GET',
							url: itemUrl,
							success: attachmentRetreive,
							error: function(jqXHR, textStatus, errorThrown){
								console.log("Error getting download from %s", url);
								updateLoadingStatus();
							}
						});
					} else {

						var linkTitle = stateMap.idTitleMap[fileID] + "(Cannot Download)";
						$downloadItem.find(".download-title").html(linkTitle);
						$downloadCbox.attr("title", linkTitle);
						$downloadItem.addClass("download-error");
						$downloadCbox.attr("disabled", "disabled");							
						updateLoadingStatus();
						
					}
				}(fileIDs[i], moduleTitle, $moduleCheckboxContainer));
			}

			jqueryMap.$moduleContainer.append($moduleDiv);
			jqueryMap.modules[moduleTitle] = $moduleDiv;
		}
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

		//setup event handlers
		jqueryMap.$downloadBtn.click(handleDownloadButtonClick);
		jqueryMap.$downloadAllCbox.change(handleAllCboxChanged);
		
		
		//Ask for all the module URLS from the page
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			stateMap.current_tab = tabs[0];

			chrome.tabs.sendMessage(tabs[0].id, {type: "getFileIDs"}, function(response){
				console.log(response);
				
				if (response && response.fileIDs){
					stateMap.course_title = response.courseTitle;
					if (stateMap.course_title == ""){
						stateMap.course_title = "no_title";
					}
					stateMap.course_id = configMap.course_regex.exec(tabs[0].url)[1];
					createCheckBoxes(response.fileIDs, response.fileTitles, response.fileTypes);

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
