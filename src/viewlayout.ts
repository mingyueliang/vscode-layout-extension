import * as vscode from 'vscode';
import * as fs from 'fs';
// import { resolve, basename, dirname, join, extname} from 'path';
import * as os from 'os';
import * as child_process from 'child_process';
import { stderr, stdout } from 'process';
import * as path from 'path';
import { SilentReporter } from '@vscode/test-electron';



let webviewPanel = new Map();
let pythonInterpreter = 'py -3';
let fmmtPath = '';

function readFile(filePath: string){
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function isFileExisted(filePath: string) {
    return new Promise((resolve, reject) => {
        fs.access(filePath, (err) => {
            if (err) {
                reject(false);
            } else {
                resolve(true);
            }
        });
    });
}


function getHackPath(file:string){
    if (isWinOS()) {
        return file.substring(1);
    }
    return file;
}

/**
 * @description get system platform
 */
function isWinOS() {
	return os.platform() === 'win32';
}
  
function isMacOS() {
	return os.platform() === 'darwin';
}

function isLinuxOS() {
	return os.platform() === 'linux';
}

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
                <li>Modules</li>
                <li>FV Info</li>
                <li>GUID xref</li>
                <li id="uploadfile">Add FV</li>
                <li onclick="deleteLiNode()">Clear</li>
                <li>export</li>
                <li>Raw Export</li>
                <li>Extract Data</li>
                <li>Extract Raw</li>
            </ul>
        </div>
        <div id="box"></div>
        <input type="file" id="file" style="display:none" accept=".fd,.Fv, .fv,.ffs,.sec" multiple="multiple">
        
        <script type="text/javascript">
            const vscode = acquireVsCodeApi();

            // revice message from vscode
            window.addEventListener('message', event => {
                const message = event.data;
                console.log('webview接收到的消息: '+message.files)
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

                myfile.unbind().change(function (e){
                    var files = e.target.files
                    if (files.length){
                        var fileString = []
                        for (var i=0; i<files.length; i++){
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
                // Set show or hide for ul.
                showOrHideList('${outName}')
            }

            function showOrHideList(){
                var ul = document.getElementById('box')
                ul.onclick = function(e){
                    $(function () {
                        $("li:has(ul)").click(function(event) {
                            if (this == event.target) {
                                if ($(this).children().is(':hidden')){
                                    $(this)
                                    // .css('list-style-image', 'url(${minuspath})')
                                    .children().show()
                                } else {
                                    $(this)
                                    // .css('list-style-image', 'url(${plusPath})')
                                    .children().hide()
                                }
                            }
                            return false
                        })
                        .css('cursor', 'pointer')
                        .click()
            
                        $('li:not(:has(ul))').css({
                            cursor: 'default',
                            'list-style-image': 'none'
                        })
            
                        $('li:has(ul)').css({
                            cursor: 'default',
                            // 'list-style-image': 'url(${plusPath})'
                        })
                    })            
                }
            }

            function createLayout(className, jsonPath, fileType){
                var fdbox = document.getElementById('box')
                var fdul = document.createElement('ul')
                fdul.setAttribute('class', className)
                fdbox.appendChild(fdul)
                var fdli = document.createElement('li')
                var oneIdName = fileType + GenNonDuplicateID()
                fdli.setAttribute('id', oneIdName)
                fdul.appendChild(fdli)

                $.getJSON(jsonPath, function(result){
                    if (result) {
                        var data = result[Object.keys(result)[0]]
                        setInnerText(fdli, className + " Files=" + data['FilesNum']+" Type="+fileType)
                        
                        var fvul = document.createElement('ul')
                        fdli.appendChild(fvul)
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
                            } else if (fileType.search(/fd|fv/gi) !== -1){
                                name = 'FvNameGuid'
                            }
                            setInnerText(fvli, fvObj['Name']+'('+fvObj[name]+')'+' Size='+fvObj['Size']+' Offset='+fvObj['Offset']+' Files='+fvObj['FilesNum'])

                            // get ffs in fv
                            var ffsbox = document.getElementById(idName)
                            var ffsul = document.createElement('ul')
                            ffsbox.appendChild(ffsul)
                            $.each(fvObj["Files"], function(ffsIndex, ffsObj){
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
                                $.each(ffsObj["Files"], function(secIndex, secObj){
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
                var ul = document.querySelector('#box')
                var list = ul.querySelectorAll('ul')

                for (var i=0; i<list.length; i++) {
                    list[i].remove()
                }
            }
    
            // Generate random code
            function GenNonDuplicateID(){
                return Math.random().toString(36).substr(2)
            }

        </script>
    </body>
    </html>`);
}

module.exports =function(context: vscode.ExtensionContext){
    context.subscriptions.push(vscode.commands.registerCommand('vscode-view-fd-fv-ffs-sec-layout-extension.viewlayout', (uri) => {
        vscode.window.showInformationMessage("view layout");
        var filePath = getHackPath(uri.path);
        var outName = path.basename(filePath);
        var index = outName.lastIndexOf('.');
        var fileType = outName.substring(index+1);
        var sourceFilePath = path.join(path.dirname(path.dirname(__filename)), `./Layout_${outName}.json`);

        createPanel(context, outName, sourceFilePath, filePath, fileType);        
    }));
};


async function showTermianl(sourceFilePath:string, filePath:string) {
    fs.stat(sourceFilePath, function(err, stat) {
        if (stat&&stat.isFile()){
            console.log('json file is exist');
        } else {
            if (isLinuxOS() === true || isMacOS() === true){
                pythonInterpreter = 'python3';
            }
            fmmtPath = path.join(path.dirname(__dirname), 'utils/FMMT2/FMMT.py');
            var commands = `${pythonInterpreter} ${fmmtPath} -v ${filePath} -l json`;
            
            // run FMMT.py in terminal
            // var _terminal = vscode.window.createTerminal(
            //     {
            //         name: 'view-layout',
            //         cwd: path.dirname(path.dirname(__filename))
            //     }
            // );
            // _terminal.sendText(commands);
            // _terminal.show();

            // create process to run FMMT.py
            let cwd = path.join(path.dirname(__dirname));
            const output = child_process.execSync(commands, {cwd: cwd});
            console.log(output.toString()); 
        }
    });
};

async function createPanel(context: vscode.ExtensionContext, outName:string, sourceFilePath:string, filePath:string, fileType:string) {
    var column = vscode.window.activeTextEditor?vscode.window.activeTextEditor.viewColumn:undefined;
        // If we already have a panel, show it.
        if (webviewPanel.get(outName)) {
          webviewPanel.get(outName).reveal(column);
        } else {
            await showTermianl(sourceFilePath, filePath);
            await sleep(2000);
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
                console.log(message);
                var resFiles = [];
                var files = message.filepath.split(";");
                for (let index = 0; index < files.length; index++) {
                    var fileName = path.basename(files[index]);
                    var filePath = path.join(path.dirname(path.dirname(__filename)), `./Layout_${fileName}.json`);
                    showTermianl(filePath, files[index]);
                    await sleep(2000);
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
