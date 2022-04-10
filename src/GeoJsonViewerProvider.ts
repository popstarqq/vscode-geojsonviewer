import * as vscode from 'vscode';
import * as path from 'path';
import { getNonce, WebviewCollection, GeoJsonDocument, disposeAll } from './util';

/**
 * 创建一个geojson视图提供器类，该类继承自接口CustomReadonlyEditorProvider
 */  
export class GeoJsonViewerProvider implements vscode.CustomReadonlyEditorProvider<GeoJsonDocument> {
    // 构造函数
    constructor(
        private readonly _context: vscode.ExtensionContext
    ) { }
    // 注册窗口编辑器提供器
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.window.registerCustomEditorProvider(
            GeoJsonViewerProvider.viewType,
            new GeoJsonViewerProvider(context),
            {
                // Keeps the webview alive even when it is not visible. You should avoid using this setting
                // unless is absolutely required as it does have memory overhead.
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            });
    }
    // 静态属性
    private static readonly viewType = 'geojsonViewer.viewer';

    /**
     * 跟踪所有webviews
     */
    private readonly webviews = new WebviewCollection();



    //#region CustomReadonlyEditorProvider

    // 实现CustomReadonlyEditorProvider接口中的openCustomDocument方法
    // 用提供的资源创建一个新的文档
    openCustomDocument(
        uri: vscode.Uri,
        openContext: { backupId?: string },
        _token: vscode.CancellationToken
    ): GeoJsonDocument {
        const document = new GeoJsonDocument(uri);
        const listeners: vscode.Disposable[] = [];

        listeners.push(document.onDidChangeContent(e => {
            // Update all webviews when the document changes
            for (const webviewPanel of this.webviews.get(document.uri)) {
                debugger;
                this.postMessage(webviewPanel, 'update', {});
            }
        }));

        document.onDidDispose(() => disposeAll(listeners));

        return document;
    }
    // 实现CustomReadonlyEditorProvider接口中的openCustomDocument方法
    // 当用户打开一个新编辑器的时候，该方法被唤醒
    resolveCustomEditor(
        document: GeoJsonDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): void {
        // 添加webview到内部webviews的set集合中
        this.webviews.add(document.uri, webviewPanel);

        // 组织webview的初始内容
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);
        webviewPanel.webview.onDidReceiveMessage(e => this.onMessage(document, e));
        if(document.uri.scheme === 'file' && vscode.workspace.getConfiguration('geojsonViewer').get('hotReload', true)) {
            const watcher = vscode.workspace.createFileSystemWatcher(document.uri.fsPath, true, false, true);
            watcher.onDidChange(() => webviewPanel.webview.postMessage('modelRefresh'));
            webviewPanel.onDidDispose(() => watcher.dispose());
        }

        // Wait for the webview to be properly ready before we init
        webviewPanel.webview.onDidReceiveMessage(e => {
            if (e.type === 'ready') {
                this.postMessage(webviewPanel, 'init', {});
            }
        });
    }

    //#endregion
    // 获取媒体资源路径
    private getMediaPath(scheme: string, mediaFile: string): vscode.Uri {
        return vscode.Uri.file(path.join(this._context.extensionPath, 'media', mediaFile))
            .with({ scheme: scheme });
    }
    // 获取初始设置（该设置会在后面js文件用到）
    private getSettings(uri: vscode.Uri): string {
        const initialData = {
            fileToLoad: uri.toString()
        }
        return `<meta id="vscode-3dviewer-data" data-settings="${JSON.stringify(initialData).replace(/"/g, '&quot;')}">`
    }
    // 获取脚本；返回临时脚本标签
    private getScripts(scheme: string, nonce: string): string {
        const scripts = [
            this.getMediaPath(scheme, 'initMap.js')
        ];
        return scripts
            .map(source => `<script nonce="${nonce}" src="${source}"></script>`)
            .join('\n');
    }

    /**
     * 获取静态html资源；用来在webview中显示
     */
    private getHtmlForWebview(webview: vscode.Webview, document: GeoJsonDocument): string {
        const fileToLoad = document.uri.scheme === "file" ?
            webview.asWebviewUri(vscode.Uri.file(document.uri.fsPath)) :
            document.uri;
        // webview中html依赖的脚本资源和css资源
        const scriptUri = webview.asWebviewUri(vscode.Uri.file(
            path.join(this._context.extensionPath, 'media', 'initMap.js')
        ));
        // <base> 标签为页面上的所有链接规定默认地址或默认目标。
        const mediaUri = webview.asWebviewUri(vscode.Uri.file(
            path.join(this._context.extensionPath, 'media')
        ));

        // 生成一个临时值，为了脚本能通过白名单限制
        const nonce = getNonce();

        return /* html */`<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8" />
            <link
                rel="stylesheet"
                href="https://cdn.jsdelivr.net/gh/openlayers/openlayers.github.io@master/en/v6.12.0/css/ol.css"
                type="text/css"
            />
            <style>
                html,
                body,
                .map {
                height: 100%;
                width: 100%;
                margin: 0;
                padding: 0;
                }
                .tool {
                position: absolute;
                bottom: 10px;
                right: 10px;
                margin: 0;
                padding: 0;
                }
                .tool-toggle {
                display: flex;
                }
                .tool-toggle__item {
                width: 100px;
                height: 100px;
                margin: 0 5px;
                }
                .tool-toggle__item > img {
                width: 100px;
                height: 100px;
                border-radius: 50%;
                border: solid 1px #2fb0f9;
                }
                .tool-toggle__item:hover img {
                cursor: pointer;
                transform: scale(1.1);
                }
            </style>
            <script src="https://cdn.jsdelivr.net/gh/openlayers/openlayers.github.io@master/en/v6.12.0/build/ol.js"></script>
            <title>GeoJson预览</title>
            <base href="${mediaUri}/">
            ${this.getSettings(fileToLoad)}
        </head>
        <body>
                <!-- 底图 -->
                <div id="map" class="map"></div>
                <!-- 工具 -->
                <div class="tool">
                    <div class="tool-toggle" id="toggle">
                    <div class="tool-toggle__item">
                        <img src="http://lbs.tianditu.gov.cn/images/vec_c.png" name="vec" />
                    </div>
                    <div class="tool-toggle__item">
                        <img src="http://lbs.tianditu.gov.cn/images/img_c.png" name="img" />
                    </div>
            
                    <div class="tool-toggle__item">
                        <img src="http://lbs.tianditu.gov.cn/images/ter_c.png" name="ter" />
                    </div>
                    </div>
                </div>

                ${this.getScripts('vscode-resource', nonce)}
            </body>
            </html>`;
    }

    private readonly _callbacks = new Map<number, (response: any) => void>();

    private postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
        panel.webview.postMessage({ type, body });
    }

    private onMessage(document: GeoJsonDocument, message: any) {
        switch (message.type) {
            case 'response':
                const callback = this._callbacks.get(message.requestId);
                callback?.(message.body);
                return;
        }
    }
}