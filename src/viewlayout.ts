import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as child_process from 'child_process';
import * as path from 'path';
import { resolve } from 'path';


let webviewPanel = new Map();
let pythonInterpreter = 'py -3';
let fmmtPath = '';
let fileTypeList = ["fd", "fv", "ffs", "sec"];

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
                width: 1000px;
                height: 25px;

                font-size: 0;

                list-style: none;
                padding: 0;
            }

            .menu li{
                display:inline-block;
                width:70px;
                height:50px;
                font-size:12px;

                margin-right:-1px;
                text-align:center;
                line-height:48px;
            }

            .menu li:hover{
                color:rgb(160, 29, 29);
            }

            .list {
                padding:20px;
                margin: 0px;
            }
        </style>
    </heaad>
    
    <body>
        <div>
            <ul class="menu">
                <li>FV Info</li>
                <li id="uploadfile">Add FV</li>
                <li onclick="deleteLiNode()">Clear</li>
            </ul>
        </div>
        <div id="box">
            <ul id="top"></ul>
        </div>
        <input type="file" id="file" style="display:none" accept=".fd,.Fv, .fv,.ffs,.sec">
        
        <script type="text/javascript">
            const vscode = acquireVsCodeApi();

            // revice message from vscode
            window.addEventListener('message', event => {
                const message = event.data;
                var files = message.files.split(";");
                for (var i=0;i<files.length; i++){
                    var fileObj = files[i].split(",")
                    createLayout(fileObj[0], fileObj[1], fileObj[0].split(".").pop())
                }
            });

            // add fv click
            $("#uploadfile").click(function() {
                const myfile = $("#file")
                myfile.click()

                myfile.unbind().change(function (e) {
                    var files = e.target.files
                    if (files.length){
                        var fileString = []
                        for (var i=0; i<files.length; i++) {
                            fileString.push(files[i].path)
                        // post message to vscode
                        vscode.postMessage({'filepath': fileString.join(";")})
                        }
                    }
                })
            })


            // main function
            window.onload = function() {
                // create list
                createLayout('${outName}', '${jsonPath}', '${fileType}')
                showOrHideList()
            }

            // Realize collapsible list
            function showOrHideList(){
                $(document).on('click', '#top', function (e){
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
            function createLayout(className, jsonPath, fileType) {
                var ul = document.getElementById('top')
                var li = document.createElement('li')
                var oneIdName = fileType + GenNonDuplicateID()
                li.setAttribute('id', oneIdName)
                li.setAttribute('style', 'none')
                ul.appendChild(li)

                $.getJSON(jsonPath, function(result) {
                    if (result) {
                        var data = result[Object.keys(result)[0]]
                        setInnerText(li, className + " Files=" + data['FilesNum']+" Type="+fileType)
                        
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
                            if (fileType.search(/sec/gi !== -1)) {
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
            function deleteLiNode() {
                var ul = document.querySelector('#top')
                var list = ul.querySelectorAll('li')

                for (var i=0; i<list.length; i++) {
                    list[i].remove()
                }
            }
    
            // Generate random code
            function GenNonDuplicateID() {
                return Math.random().toString(36).substr(2)
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
function generateJsonFile(sourceFilePath:string, filePath:string) {
    return new Promise((resolve)=>{
        fs.stat(sourceFilePath, function(err, stat) {
            if (stat&&stat.isFile()){
                console.log('json file is exist');
            } else {
                if (isLinuxOS() === true || isMacOS() === true){
                    pythonInterpreter = 'python3';
                }
                fmmtPath = path.join(path.dirname(__dirname), 'utils/FMMT2/FMMT.py');
                var commands = `${pythonInterpreter} ${fmmtPath} -v ${filePath} -l json`;

                // create process to run FMMT.py
                let cwd = path.join(path.dirname(__dirname));
                const output = child_process.execSync(commands, {cwd: cwd});
                console.log(output.toString());
            }
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
            await generateJsonFile(sourceFilePath, filePath);
            const panel = vscode.window.createWebviewPanel(
                'ul',
                outName,
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
            var plusPath = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, `img/plus.png`))).toString();
            var minusPath = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, `img/minus.png`))).toString();

            panel.webview.html = getWebviewContent(outName, jsonPath, filePath, fileType, plusPath, minusPath);
            
            // revice message from webview
            panel.webview.onDidReceiveMessage(async message => {
                var resFiles = [];
                var files = message.filepath.split(";");
                for (let index = 0; index < files.length; index++) {
                    var fileName = path.basename(files[index]);
                    var filePath = path.join(path.dirname(path.dirname(__filename)), `./Layout_${fileName}.json`);
                    await generateJsonFile(filePath, files[index]);
                    var onDiskPath = vscode.Uri.file(filePath);
                    resFiles.push(fileName + "," +panel.webview.asWebviewUri(onDiskPath).toString());
                }
                // post message to webview
                panel.webview.postMessage({files: resFiles.join(";")});
            }, undefined, context.subscriptions);

            // Listen for when the panel disposed
            // This happens when the user closes the panel or when the panel is closed programmatically
            panel.onDidDispose(() => dispose(panel, outName), null, []);
        }
};

/**
 * @description
 * @param ms 
 * @returns 
 */
export const sleep = (ms:number)=> {
    return new Promise(resolve=>setTimeout(resolve, ms));
};


/**
 * @description Close webview panel
 * @param panel webview panel
 * @param name webview name
 */
 function dispose(panel: vscode.WebviewPanel, name: string){
    panel.dispose();
    webviewPanel.delete(name);
};
