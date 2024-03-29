import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as child_process from 'child_process';
import * as path from 'path';
import { resolve } from 'path';


let webviewPanel = new Map();
let tempFile = new Map();
let pythonInterpreter = 'py -3';
let fmmtPath = '';
let fileTypeList = ["fd", "fv", "ffs", "sec"];

function isFileExisted(filePath:string, panel:vscode.WebviewPanel) {
    return new Promise((resolve, reject) => {
      fs.access(filePath, (err) => {
        if (err) {
            panel.webview.postMessage({
                Error: true,
                ErrorPath: filePath
            });

        //   reject(false);
        } else {
          resolve(true);
        }
      })
    })
};

/**
 * @description Get real path
 * @param file 
 * @returns 
 */
function getHackPath(file:string){
    if (isWinOS()) {
        return file.substring(1);
    }
    return file;
}

/**
 * @description Determine whether it is a windows system
 * @returns boolean
 */
function isWinOS() {
	return os.platform() === 'win32';
}

/**
 * @description Determine whether it is a MacOs system
 * @returns boolean
 */
function isMacOS() {
	return os.platform() === 'darwin';
}

/**
 * @description Determine whether it is a Linux system
 * @returns boolean
 */
function isLinuxOS() {
	return os.platform() === 'linux';
}

/**
 * @descriotion Get webview content.
 * @param outName 
 * @param jsonPath 
 * @param filePath 
 * @param fileType 
 * @param plusPath 
 * @param minuspath 
 * @returns 
 */
function getWebviewContent(outName?: string, jsonPath?: vscode.Uri, filePath?: string, fileType?: string, plusPath?: string, minuspath?:string): string {
    return (
    `
    <!DOCTYPE html>
    <html>
    <heaad>
        <meta charset="utf-8">
        <title>fd</title>
        <script src="https://ajax.aspnetcdn.com/ajax/jquery/jquery-3.5.1.min.js"></script>
        <style type="text/css">
        .menu {
            padding: 0;
            height: 20px;
            margin-block-end: 0;
        }

        .menu li{
            display: inline-block;
            float: left;
            list-style: none;
            font-size: 12px;
            margin-right: -1px;
            width: 70px;
        }

        .menu li:hover{
            color:rgb(160, 29, 29);
        }

        .list {
            padding:20px;
            margin: 0px;
        }

        #top {
            padding:0;
            margin-left:20px;
        }

        #menuBox {
            border-style: solid;
            border-bottom:none;
        }

        #box {
            border-style:solid;
            width:50%;
        }
        #box1 {
            border-style:solid;
            width:50%;
            border-left:none;
        }
        #wrap {
            display:flex;
        }

        #btn {
            width: 70px;
            margin-left: 10px;
            float: right
        }

        #hr {
            border:0px;
            margin-top: 0px;
            margin-bottom: 0px;
        }

        #input {
            margin:0;
        }

        #errorInput {
            margin:0;
        }

        #targetFvName {
            margin-left:2px;
        }

        #targetFfsPath {
            margin-left:2px;
        }

        #OutputPath {
            margin-left:2px;
        }

        #targetFfsName {
            margin-left:2px;
        }

        #fvname {
            width:100px;
        }

        #ffsname {
            width:100px;
        }

        #ffspath {
            width:100px;
        }

        #OutputPathName {
            width:100px;
        }
        </style>
    </heaad>
    
    <body>
        <div id="menuBox">
            <ul class="menu">
                <li id="newfile">FV Info</li>
                <li id="uploadfile">Add FFS</li>
                <li id="delete">Delete FFS</li>
                <li id="replace">Replace FFS</li>
                <li id="extract">Extract FFS</li>
            </ul>
        </div>
        <div id="wrap">
            <div id="box">
                <spwn>Layout source file: ${outName}</spwn>
                <ul id="top"></ul>
            </div>
            <div id="box1">
                <spwn id="afterLayout">Layout after operation</spwn>
                <ul id="top1"></ul>
            </div>
        </div>
        <input type="file" id="file" style="display:none" accept=".fd,.Fv, .fv,.ffs,.sec">
        
        <script type="text/javascript">
            const vscode = acquireVsCodeApi();

            // revice message from vscode
            window.addEventListener('message', event => {
                const message = event.data;
                if (message.Error) {
                    if (document.getElementById("errorInput")) {
                        console.log('tips is exist')
                    } else {
                        layoutErrorTips()
                    }
                }
                var file = message.resFile;
                var sourceFileName = message.sourceFileName


                var spwn = document.getElementById("afterLayout")
                if (message.mode == '-a') {
                    spwn.innerHTML = "Add " + message.targetFfsPath + " to FV(" + message.targetFvName +")"

                } else if (message.mode == '-d') {
                    spwn.innerHTML = "Delete " + message.targetFfsName + " from FV(" + message.targetFvName + ")"
                } else if (message.mode == '-r') {
                    spwn.innerHTML = "Replace " + message.targetFfsPath + " with " + message.targetFfsName + " in FV(" + message.targetFvName + ")"

                } else if (message.mode == '-e') {
                    spwn.innerHTML = "Extract " + message.targetFfsName + " from FV(" + message.targetFvName + ")"
                }

                var newFfsId = message.targetFfsName
                var elementId = 'top1'
                if (message.mode == '-a') {
                    newFfsId = message.newFfsId
                    deleteLiNode("#top")
                    createLayout(sourceFileName, message.sourcefile, sourceFileName.split(".").pop(), 'top', "", "", "")

                } else if (message.mode == '-d') {
                    deleteLiNode("#top")
                    createLayout(sourceFileName, message.sourcefile, sourceFileName.split(".").pop(), 'top', message.targetFvName, message.targetFfsName, "")
                } else if (message.mode == '-r') {
                    newFfsId = message.newFfsId
                    deleteLiNode("#top")
                    createLayout(sourceFileName, message.sourcefile, sourceFileName.split(".").pop(), 'top', message.targetFvName, message.targetFfsName, message.targetFfsName)

                } else if (message.mode == '-e') {
                    deleteLiNode("#top")
                    createLayout(sourceFileName, message.sourcefile, sourceFileName.split(".").pop(), 'top', message.targetFvName, message.targetFfsName, "")
                } else if (message.mode == '-v') {
                    deleteLiNode("#top1")
                    elementId = 'top'
                    // post clear message to vscode
                    vscode.postMessage({command:'clear'})
                }

                var index = message.outputFile.lastIndexOf("/")
                var sourceFileName = message.outputFile.substr(index+1)

                deleteLiNode("#"+elementId)
                createLayout(sourceFileName, file, sourceFileName.split(".").pop(), elementId, message.targetFvName, message.newFfsId)

                if (document.getElementById("input")) {
                    var input = document.getElementById("input")
                    document.getElementById("menuBox").removeChild(input)
                }
                if (document.getElementById("errorInput")) {
                    var errorInput = document.getElementById("errorInput")
                    document.getElementById("menuBox").removeChild(errorInput)
                }
            });

            // add fv click
            $("#uploadfile").click(function() {
                if (document.getElementById("input")) {
                    var input = document.getElementById("input")
                    document.getElementById("menuBox").removeChild(input)
                }
                if (document.getElementById("errorInput")) {
                    var errorInput = document.getElementById("errorInput")
                    document.getElementById("menuBox").removeChild(errorInput)
                }

                if (judageFileType()) {
                    var pDiv = document.createElement('p');
                    pDiv.id = "input"
                    document.getElementById('menuBox').append(pDiv)

                    var hrDiv = document.createElement('hr');
                    hrDiv.id = "hr"
                    hrDiv.innerHTML = "<hr/>";
                    document.getElementById('input').append(hrDiv)

                    var targetFvName = document.createElement("spwn")
                    targetFvName.innerHTML = "targetFvName:   "
                    targetFvName.id = "targetFvName"
                    document.getElementById('input').append(targetFvName)

                    var input = document.createElement("input")
                    input.type="text"
                    input.id="fvname"
                    input.placeholder="Type Target FV Name"
                    document.getElementById('input').append(input)


                    var targetFfsPathName = document.createElement("spwn")
                    targetFfsPathName.innerHTML = "targetFfsPath: "
                    targetFfsPathName.id = "targetFfsPath"
                    document.getElementById('input').append(targetFfsPathName)

                    var name = document.createElement("input")
                    name.type="text"
                    name.id="ffspath"
                    name.placeholder="Type new ffs file absolute path"
                    document.getElementById('input').append(name)

                    var OutputPath = document.createElement("spwn")
                    OutputPath.innerHTML = "outputPath:   "
                    OutputPath.id = "OutputPath"
                    document.getElementById('input').append(OutputPath)

                    var OutputPathName = document.createElement("input")
                    OutputPathName.type="text"
                    OutputPathName.id="OutputPathName"
                    OutputPathName.placeholder="Type output file abs path"
                    document.getElementById('input').append(OutputPathName)


                    var button = document.createElement("input")
                    button.id="btn"
                    button.type="button"
                    button.value="ok"
                    button.onclick = function () {
                        if (document.getElementById("fvname").value && document.getElementById("ffspath").value && document.getElementById("OutputPathName").value) {
                            vscode.postMessage({inputfile:'${filePath}', targetFvName:document.getElementById("fvname").value, targetFfsName:"", targetFfsPath:document.getElementById("ffspath").value, outputfile:document.getElementById("OutputPathName").value, mode:"-a", command:""})
                        } else {
                            if (document.getElementById("errorInput")) {
                                // var errorInput = document.getElementById("errorInput")
                                // document.getElementById("menuBox").removeChild(errorInput)
                                console.log('Tips is exist')
                            } else {
                                layoutErrorTips()
                            }
                        }
                    }
                    document.getElementById('input').append(button)
                } else {
                    console.log("The file type that cannot be operated when currently opened")
                    var spwn = document.getElementById("afterLayout")
                    spwn.innerHTML = "The currently opened file is ${outName} and cannot be added, deleted, replaced, or extract."
                    spwn.style.backgroundColor = 'red'
                }
            })

            $("#delete").click(function (e) {
                if (document.getElementById("input")) {
                    var input = document.getElementById("input")
                    document.getElementById("menuBox").removeChild(input)
                }
                if (document.getElementById("errorInput")) {
                    var errorInput = document.getElementById("errorInput")
                    document.getElementById("menuBox").removeChild(errorInput)
                }

                if (judageFileType()) {
                    var pDiv = document.createElement('p');
                    pDiv.id = "input"
                    document.getElementById('menuBox').append(pDiv)

                    var hrDiv = document.createElement('hr');
                    hrDiv.id = "hr"
                    hrDiv.innerHTML = "<hr/>";
                    document.getElementById('input').append(hrDiv)

                    var brDiv = document.createElement('br');
                    brDiv.innerHTML = "<br/>";

                    var targetFvName = document.createElement("spwn")
                    targetFvName.innerHTML = "targetFvName:   "
                    targetFvName.id = "targetFvName"
                    document.getElementById('input').append(targetFvName)

                    var input = document.createElement("input")
                    input.type="text"
                    input.id="fvname"
                    input.placeholder="Type Target FV Name"

                    document.getElementById('input').append(input)
                    // document.getElementById('input').append(brDiv)


                    var brDiv1 = document.createElement('br');
                    brDiv1.innerHTML = "<br/>";

                    var targetFfsName = document.createElement("spwn")
                    targetFfsName.innerHTML = "targetFfsName:  "
                    targetFfsName.id = "targetFfsName"
                    document.getElementById('input').append(targetFfsName)

                    var name = document.createElement("input")
                    name.type="text"
                    name.id="ffsname"
                    name.placeholder="Type Target FFS Name"

                    document.getElementById('input').append(name)
                    // document.getElementById('input').append(brDiv1)


                    var brDiv2 = document.createElement('br');
                    brDiv2.innerHTML = "<br/>";

                    var OutputPath = document.createElement("spwn")
                    OutputPath.innerHTML = "outputPath:    "
                    OutputPath.id = "OutputPath"
                    document.getElementById('input').append(OutputPath)

                    var OutputPathName = document.createElement("input")
                    OutputPathName.type="text"
                    OutputPathName.id="OutputPathName"
                    OutputPathName.placeholder="Type output file abs path"

                    document.getElementById('input').append(OutputPathName)
                    // document.getElementById('input').append(brDiv2)


                    var button = document.createElement("input")
                    button.id="btn"
                    button.type="button"
                    button.value="ok"
                    button.onclick = function () {
                        var fvName = document.getElementById("fvname").value
                        var ffsName = document.getElementById("ffsname").value
                        var outputPath = document.getElementById("OutputPathName").value
                        if (fvName && ffsName && outputPath) {
                            vscode.postMessage({inputfile:'${filePath}', targetFvName:document.getElementById("fvname").value, targetFfsName:document.getElementById("ffsname").value, targetFfsPath:"", outputfile:document.getElementById("OutputPathName").value, mode:"-d",command:""})
                        } else {
                            if (document.getElementById("errorInput")) {
                                console.log('Tips is exist')
                            } else {
                                layoutErrorTips()
                            }
                        }
                    }
                    document.getElementById('input').append(button)
                } else {
                    console.log("The file type that cannot be operated when currently opened")
                    var spwn = document.getElementById("afterLayout")
                    spwn.innerHTML = "The currently opened file is ${outName} and cannot be added, deleted, replaced, or extract."
                    spwn.style.backgroundColor = 'red'
                }
            })

            $("#replace").click(function (e) {
                if (document.getElementById("input")) {
                    var input = document.getElementById("input")
                    document.getElementById("menuBox").removeChild(input)
                }
                if (document.getElementById("errorInput")) {
                    var errorInput = document.getElementById("errorInput")
                    document.getElementById("menuBox").removeChild(errorInput)
                }

                if (judageFileType()) {
                    var pDiv = document.createElement('p');
                    pDiv.id = "input"
                    document.getElementById('menuBox').append(pDiv)

                    var hrDiv = document.createElement('hr');
                    hrDiv.id = "hr"
                    hrDiv.innerHTML = "<hr/>";
                    document.getElementById('input').append(hrDiv)

                    var brDiv = document.createElement('br');
                    brDiv.innerHTML = "<br/>";

                    var targetFvName = document.createElement("spwn")
                    targetFvName.innerHTML = "targetFvName:   "
                    targetFvName.id = "targetFvName"
                    document.getElementById('input').append(targetFvName)

                    var input = document.createElement("input")
                    input.type="text"
                    input.id="fvname"
                    input.placeholder="Type Target FV Name"
                    document.getElementById('input').append(input)
                    // document.getElementById('input').append(brDiv)

                    var brDiv1 = document.createElement('br');
                    brDiv1.innerHTML = "<br/>";

                    var targetFfsName = document.createElement("spwn")
                    targetFfsName.innerHTML = "targetFfsName: "
                    targetFfsName.id = "targetFfsName"

                    var ffsname = document.createElement("input")
                    ffsname.type="text"
                    ffsname.id="ffsname"
                    ffsname.placeholder="Type Target FFS Name"

                    document.getElementById('input').append(targetFfsName)
                    document.getElementById('input').append(ffsname)
                    // document.getElementById('input').append(brDiv1)

                    var targetFfsPathName = document.createElement("spwn")
                    targetFfsPathName.innerHTML = "targetFfsPath: "
                    targetFfsPathName.id = "targetFfsPath"
                    document.getElementById('input').append(targetFfsPathName)

                    var name = document.createElement("input")
                    name.type="text"
                    name.id="ffspath"
                    name.placeholder="Type new ffs file absolute path"
                    document.getElementById('input').append(name)


                    var brDiv2 = document.createElement('br');
                    brDiv2.innerHTML = "<br/>";
                    // document.getElementById('input').append(brDiv2)

                    var OutputPath = document.createElement("spwn")
                    OutputPath.innerHTML = "outputPath:    "
                    OutputPath.id = "OutputPath"

                    var OutputPathName = document.createElement("input")
                    OutputPathName.type="text"
                    OutputPathName.id="OutputPathName"
                    OutputPathName.placeholder="Type output file abs path"

                    document.getElementById('input').append(OutputPath)
                    document.getElementById('input').append(OutputPathName)
                    var brDiv3 = document.createElement('br');
                    brDiv3.innerHTML = "<br/>";
                    // document.getElementById('input').append(brDiv3)


                    var button = document.createElement("input")
                    button.id="btn"
                    button.type="button"
                    button.value="ok"
                    button.onclick = function () {
                        if (document.getElementById("fvname").value && document.getElementById("ffsname").value && document.getElementById("ffspath").value && document.getElementById("OutputPathName").value) {
                            vscode.postMessage({inputfile:'${filePath}', targetFvName:document.getElementById("fvname").value, targetFfsName:document.getElementById("ffsname").value, targetFfsPath:document.getElementById("ffspath").value, outputfile:document.getElementById("OutputPathName").value, mode:"-r", command:""})
                        } else {
                            if (document.getElementById("errorInput")) {
                                console.log('Tips is exist')
                            } else {
                                layoutErrorTips()
                            }
                        }
                    }
                    document.getElementById('input').append(button)
                } else {
                    console.log("The file type that cannot be operated when currently opened")
                    var spwn = document.getElementById("afterLayout")
                    spwn.innerHTML = "The currently opened file is ${outName} and cannot be added, deleted, replaced, or extract."
                    spwn.style.backgroundColor = 'red'
                }
            })

            $("#extract").click(function (e) {
                if (document.getElementById("input")) {
                    var input = document.getElementById("input")
                    document.getElementById("menuBox").removeChild(input)
                }
                if (document.getElementById("errorInput")) {
                    var errorInput = document.getElementById("errorInput")
                    document.getElementById("menuBox").removeChild(errorInput)
                }

                if (judageFileType()) {
                    var pDiv = document.createElement('p');
                    pDiv.id = "input"
                    document.getElementById('menuBox').append(pDiv)

                    var hrDiv = document.createElement('hr');
                    hrDiv.id = "hr"
                    hrDiv.innerHTML = "<hr/>";
                    document.getElementById('input').append(hrDiv)

                    var brDiv = document.createElement('br');
                    brDiv.innerHTML = "<br/>";

                    var targetFvName = document.createElement("spwn")
                    targetFvName.innerHTML = "targetFvName:   "
                    targetFvName.id = "targetFvName"

                    var input = document.createElement("input")
                    input.type="text"
                    input.id="fvname"
                    input.placeholder="Type Target FV Name"

                    document.getElementById('input').append(targetFvName)
                    document.getElementById('input').append(input)
                    // document.getElementById('input').append(brDiv)


                    var brDiv1 = document.createElement('br');
                    brDiv1.innerHTML = "<br/>";

                    var targetFfsName = document.createElement("spwn")
                    targetFfsName.innerHTML = "targetFfsName: "
                    targetFfsName.id = "targetFfsName"

                    var name = document.createElement("input")
                    name.type="text"
                    name.id="ffsname"
                    name.placeholder="Type Target FFS Name"

                    document.getElementById('input').append(targetFfsName)
                    document.getElementById('input').append(name)
                    // document.getElementById('input').append(brDiv1)


                    var brDiv2 = document.createElement('br');
                    brDiv2.innerHTML = "<br/>";

                    var OutputPath = document.createElement("spwn")
                    OutputPath.innerHTML = "outputPath:    "
                    OutputPath.id = "OutputPath"

                    var OutputPathName = document.createElement("input")
                    OutputPathName.type="text"
                    OutputPathName.id="OutputPathName"
                    OutputPathName.placeholder="Type output file abs path"

                    document.getElementById('input').append(OutputPath)
                    document.getElementById('input').append(OutputPathName)
                    // document.getElementById('input').append(brDiv2)

                    var button = document.createElement("input")
                    button.id="btn"
                    button.type="button"
                    button.value="ok"
                    button.onclick = function () {
                        if (document.getElementById("fvname").value && document.getElementById("ffsname").value && document.getElementById("OutputPathName").value) {
                            vscode.postMessage({inputfile:'${filePath}', targetFvName:document.getElementById("fvname").value, targetFfsName:document.getElementById("ffsname").value, targetFfsPath:"", outputfile:document.getElementById("OutputPathName").value, mode:"-e",command:""})
                        } else {
                            if (document.getElementById("errorInput")) {
                                console.log('Tips is exist')
                            } else {
                                layoutErrorTips()
                            }
                        }
                    }
                    document.getElementById('input').append(button)
                } else {
                    console.log("The file type that cannot be operated when currently opened")
                    var spwn = document.getElementById("afterLayout")
                    spwn.innerHTML = "The currently opened file is ${outName} and cannot be added, deleted, replaced, or extract."
                    spwn.style.backgroundColor = 'red'
                }
            })

            function layoutErrorTips() {
                var pDiv = document.createElement('p');
                pDiv.id = "errorInput"
                document.getElementById('menuBox').append(pDiv)

                var hrDiv = document.createElement('hr');
                hrDiv.id = "hr"
                hrDiv.innerHTML = "<hr/>";
                document.getElementById('errorInput').append(hrDiv)

                var tips = document.createElement("spwn")
                document.getElementById("errorInput").append(tips)
                tips.innerHTML = "Input error, please try again !!!"
                tips.style.backgroundColor = 'red'
            }


            // main function
            window.onload = function() {
                // create list
                createLayout('${outName}', '${jsonPath}', '${fileType}', 'top', [])
                showOrHideList()
            }


            // Realize collapsible list
            function showOrHideList(){
                $(document).on('click', '#wrap', function (e){
                    var lis = $("li:has(ul)")
                    for (var index=0; index<lis.length; index++) {
                        lis[index].addEventListener('click', function(event) {
                            if (this == event.target) {
                                if ($(this).children().is(':hidden')){
                                    $(this)
                                    .css('list-style-image', 'url(${minuspath})')
                                    .children().show()
                                } else {
                                    $(this)
                                    .css('list-style-image', 'url(${plusPath})')
                                    .children().hide()
                                }
                            }
                            return false
                        })
                    }

                    $('li:not(:has(ul))').css({
                        cursor: 'default',
                        'list-style-image': 'none'
                    })
                })
            }


            // Create file layout
            function createLayout(sourceFileName, jsonPath, fileType, wrap, fvName, newFfsId, oldFfsName) {
                var ul = document.getElementById(wrap)
                var li = document.createElement('li')
                var oneIdName = fileType + GenNonDuplicateID()
                li.setAttribute('id', oneIdName)
                li.setAttribute('style', 'none')
                ul.appendChild(li)

                $.getJSON(jsonPath, function(result) {
                    if (result) {
                        var data = result[Object.keys(result)[0]]
                        setInnerText(li, sourceFileName + " Files=" + data['FilesNum']+" Type="+fileType)
                        
                        var fvul = document.createElement('ul')
                        li.appendChild(fvul)
                        fvul.setAttribute('id','ul')
                        // FV info
                        $.each(data['Files'], function(index, obj) {
                            var fvObj = obj[Object.keys(obj)[0]]
                            var fvli = document.createElement('li')
                            var idName = fileType + GenNonDuplicateID()
                            fvli.setAttribute('id', idName)
                            fvul.appendChild(fvli)

                            var name = ''
                            if (fileType.search(/ffs/gi) !== -1) {
                                name = 'UiName'
                            } else if (fileType.search(/fd|fv/gi) !== -1) {
                                name = 'FvNameGuid'
                            }
                            if (fileType.search(/sec/gi) !== -1) {
                                setInnerText(fvli, fvObj['Name']+' Size='+fvObj['Size']+' Offset='+fvObj['Offset']+' Files='+fvObj['FilesNum'])
                            } else {
                                setInnerText(fvli, fvObj['Name']+'('+fvObj[name]+')'+' Size='+fvObj['Size']+' Offset='+fvObj['Offset']+' Files='+fvObj['FilesNum'])
                            }

                            if (fvObj['Files'] === undefined) {
                                return true
                            }
                            // get ffs in fv
                            var ffsbox = document.getElementById(idName)
                            var ffsul = document.createElement('ul')
                            ffsbox.appendChild(ffsul)
                            $.each(fvObj["Files"], function(ffsIndex, ffsObj) {
                                ffsObj = ffsObj[Object.keys(ffsObj)[0]]
                                var ffsli = document.createElement('li')
                                var ffsIdName = GenNonDuplicateID()
                                ffsli.setAttribute('id', ffsIdName)
                                //
                                if (newFfsId) {
                                    if (wrap == "top") {
                                        if (fvObj[name] == fvName) {
                                            if (ffsObj['Name'] == newFfsId) {
                                                ffsli.style.backgroundColor = 'green'
                                            }
                                        }    
                                    }else if (wrap == "top1") {
                                        if (fvObj[name] == fvName) {
                                            if (ffsObj['Name'] == newFfsId) {
                                                ffsli.style.backgroundColor = 'darkorange'
                                            }
                                        }    
                                    }
                                }

                                ffsul.appendChild(ffsli)
                                setInnerText(ffsli, ffsObj['Name']+' '+ffsObj['Type']+' Offset='+ffsObj['Offset']+' Size='+ffsObj['Size'])

                                // get sec in ffs
                                if (ffsObj['Files'] === undefined) {
                                    // skip current each loop
                                    return true
                                }
                                var secbox = document.getElementById(ffsIdName)
                                var secul = document.createElement('ul')
                                secbox.appendChild(secul)
                                $.each(ffsObj["Files"], function(secIndex, secObj) {
                                    secObj = secObj[Object.keys(secObj)[0]]
                                    var secli = document.createElement('li')
                                    secul.appendChild(secli)
                                    setInnerText(secli, secObj['Name']+' Offset='+secObj['Offset']+' Size='+secObj['Size'])
                                })    
                            }) 
                        })
                    } else {
                        console.log('data is none')
                    }
                })
            }
            
            // Set node text.
            function setInnerText(element, content) {
                if (typeof(element.innerText === 'string')) {
                    element.innerText=content
                }else {
                    element.innerText=content
                }
            } 
            // Clear all ul nodes in div (id='box').
            function deleteLiNode(id) {
                var ul = document.querySelector(id)
                var list = ul.querySelectorAll('li')

                for (var i=0; i<list.length; i++) {
                    list[i].remove()
                }
            }
    
            // Generate random code
            function GenNonDuplicateID() {
                return Math.random().toString(36).substr(2)
            }

            // Current file in [.fd,.fv]
            function judageFileType() {
                if ('${fileType}'.toLowerCase() == 'fd' || '${fileType}'.toLowerCase() == 'fv') {
                    return true
                } else {
                    return false
                }
            }
        </script>
    </body>
    </html>`);
}

module.exports =function(context: vscode.ExtensionContext){
    context.subscriptions.push(vscode.commands.registerCommand('vscode-view-fd-fv-ffs-sec-layout-extension.viewlayout', (uri) => {
        vscode.window.showInformationMessage("Loading current file layout......");
        var filePath = getHackPath(uri.path);
        var outName = path.basename(filePath);
        var index = outName.lastIndexOf('.');
        var fileType = outName.substring(index+1);
        if (fileTypeList.indexOf(fileType.toLowerCase()) === -1) {
            vscode.window.showErrorMessage("Error: Wrong file type, Please re select!!!");
            return;
        }
        var sourceFilePath = path.join(path.dirname(path.dirname(__filename)), `./Layout_${outName}.json`);

        createPanel(context, outName, sourceFilePath, filePath, fileType);        
    }));
};

/**
 * @description Call FMMT tool to parser current file.
 * @param sourceFilePath 
 * @param filePath 
 */
function generateJsonFile(sourceFilePath:string, filePath:string, mode:string, outputfile?:string, fvName?:string, ffsName?:string, ffsPath?:string) {
    return new Promise((resolve)=>{
        fs.stat(sourceFilePath, function(err, stat) {
            if (isLinuxOS() === true || isMacOS() === true){
                pythonInterpreter = 'python3';
            }
            fmmtPath = path.join(path.dirname(__dirname), 'utils/FMMT/FMMT.py');
            var commands = '';
            /* Generate command strings for different functions of fmmt tool
                * view(-v): View each FV and the named files within each FV: '-v inputfile outputfile, inputfiletype(.Fd/.Fv/.ffs/.sec)
                * add(-a): Add a Ffs into a FV:'-a inputfile TargetFvName newffsfile outputfile
                * delete(-d): Delete a Ffs from FV: '-d inputfile TargetFvName(Optional) TargetFfsName outputfile\
                    If not given TargetFvName, all the existed target Ffs will be deleted
                * replace(-r): Replace a Ffs in a FV: '-r inputfile TargetFvName(Optional) TargetFfsName newffsfile outputfile\
                    If not given TargetFvName, all the existed target Ffs will be replaced with new Ffs file)
                * extract(-e): Extract a Ffs Info: '-e inputfile TargetFvName(Optional) TargetFfsName outputfile\
                    If not given TargetFvName, the first found target Ffs will be extracted
            */
            if (mode === '-v') {
                commands = `${pythonInterpreter} ${fmmtPath} ${mode} ${filePath} -l json`;
            } else if (mode === '-a') {
                commands = `${pythonInterpreter} ${fmmtPath} ${mode} ${filePath} ${fvName} ${ffsPath} ${outputfile}`
            } else if (mode === '-d') {
                commands = `${pythonInterpreter} ${fmmtPath} ${mode} ${filePath} ${fvName} ${ffsName} ${outputfile}`
            } else if (mode === '-r') {
                commands = `${pythonInterpreter} ${fmmtPath} ${mode} ${filePath} ${fvName} ${ffsName} ${ffsPath} ${outputfile}`
            } else if (mode === '-e') {
                commands = `${pythonInterpreter} ${fmmtPath} ${mode} ${filePath} ${fvName} ${ffsName} ${outputfile}`
            }

            // create process to run FMMT.py
            let cwd = path.join(path.dirname(__dirname));
            const output = child_process.execSync(commands, {cwd: cwd});
            console.log(output.toString());
            resolve("Success");
        });
    });
};

/**
 * @description Create webview panel
 * @param context 
 * @param outName Current file name
 * @param sourceFilePath 
 * @param filePath 
 * @param fileType 
 */
async function createPanel(context: vscode.ExtensionContext, outName:string, sourceFilePath:string, filePath:string, fileType:string) {
    var column = vscode.window.activeTextEditor?vscode.window.activeTextEditor.viewColumn:undefined;
        // If we already have a panel, show it.
        if (webviewPanel.get(outName)) {
          webviewPanel.get(outName).reveal(column);
        } else {
            tempFile.set(outName, [sourceFilePath])
            await generateJsonFile(sourceFilePath, filePath, '-v');
            const panel = vscode.window.createWebviewPanel(
                'ul',
                "FMMT Tool",
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                }
            );
            webviewPanel.set(outName, panel);
            // set html content
            var onDiskPath = vscode.Uri.file(sourceFilePath);
            var jsonPath = onDiskPath.with({scheme: 'vscode-resource'});
            // load img resource
            var plusPath = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, `img/plus1.png`))).toString();
            var minusPath = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, `img/minus1.png`))).toString();

            panel.webview.html = getWebviewContent(outName, jsonPath, filePath, fileType, plusPath, minusPath);
            
            // revice message from webview
            panel.webview.onDidReceiveMessage(async message => {
                var inputFile = message.inputfile;
                var outputPath = message.outputfile
                // judage output file is abs path
                if (path.isAbsolute(outputPath) === false) {
                    outputPath = path.join(path.dirname(inputFile), outputPath)
                }
                // Judage isexist of new ffs file.
                if (message.targetFfsPath) {
                var targetFfsPath = message.targetFfsPath
                if (path.isAbsolute(targetFfsPath) === false) {
                    targetFfsPath = path.join(path.dirname(message.inputfile), targetFfsPath)
                }
                // Check path of new ffs file.
                const isExisted = await isFileExisted(targetFfsPath, panel);
                }

                var sourceFile = panel.webview.asWebviewUri(vscode.Uri.file(sourceFilePath)).toString()
                var targetPath = path.join(context.extensionPath, `Layout_new_${path.basename(inputFile)}.json`)
                tempFile.get(outName).push(targetPath)
                var resFilePath = panel.webview.asWebviewUri(vscode.Uri.file(targetPath)).toString()
                await generateJsonFile(targetPath, inputFile, message.mode, outputPath, message.targetFvName, message.targetFfsName, targetFfsPath)
                if (message.mode == "-e") {
                    var ffsName = path.basename(outputPath)
                    targetPath = path.join(path.dirname(path.dirname(__filename)), `Layout_${ffsName}.json`);
                    tempFile.get(outName).push(targetPath)
                    resFilePath = panel.webview.asWebviewUri(vscode.Uri.file(targetPath)).toString()
                    await generateJsonFile(targetPath, outputPath, '-v')
                    panel.webview.postMessage({
                        sourcefile: sourceFile, 
                        sourceFileName: path.basename(outputPath),
                        resFile: resFilePath, 
                        mode: message.mode, 
                        targetFvName: message.targetFvName, 
                        targetFfsName:message.targetFfsName, 
                        targetFfsPath:targetFfsPath,
                        outputFile:outputPath
                    });
                } else {
                    var newFfsId
                    if (message.mode == '-a' || message.mode == '-r') {
                        // Read name of new ffs file.
                        var newFfsName = path.basename(targetFfsPath)
                        var ffsJsonPath = path.join(path.dirname(path.dirname(__filename)), `Layout_${newFfsName}.json`);
                        tempFile.get(outName).push(ffsJsonPath)
                        await generateJsonFile(ffsJsonPath, targetFfsPath, '-v')
                        var newFfsId = readJsonFile(ffsJsonPath)
                    }
                    // post message to webview
                    panel.webview.postMessage({
                        sourcefile: sourceFile,
                        sourceFileName: path.basename(outputPath),
                        resFile: resFilePath,
                        mode: message.mode,
                        targetFvName: message.targetFvName,
                        targetFfsName:message.targetFfsName,
                        targetFfsPath:targetFfsPath,
                        newFfsId: newFfsId,
                        outputFile:outputPath
                    });
                }
            }, undefined, context.subscriptions);

            // Listen for when the panel disposed
            // This happens when the user closes the panel or when the panel is closed programmatically
            panel.onDidDispose(() => dispose(panel, outName), null, []);
        }
};


/**
 * @description Close webview panel
 * @param panel webview panel
 * @param name webview name
 */
 function dispose(panel: vscode.WebviewPanel, name: string){
    panel.dispose();
    webviewPanel.delete(name);
    clearTempFile(name)
    tempFile.delete(name)
};

/**
 * 
 * @param name Current open file.
 */
export function clearTempFile(name: string) {
    var files = tempFile.get(name);
    files.forEach((file:string) => {
        fs.stat(file, function(err, stat){
            if (stat&&stat.isFile()){
                fs.unlinkSync(file)
            }
        })
    })
}

/**
 * 
 * @param file Current ffs file
 * @returns guidID(ffs name) of Current ffs file
 */
export function readJsonFile(file:fs.PathLike) {
    if (fs.existsSync(file)) {
        let userJson = JSON.parse(fs.readFileSync(file, 'utf-8'))
        let ffsObj = userJson[Object.keys(userJson)[0]]['Files'][0]
        let ffsName = ffsObj[Object.keys(ffsObj)[0]]['Name']
        return ffsName
    }
}

