import * as vscode from 'vscode';

import { GeoJsonViewerProvider } from './GeoJsonViewerProvider';


export function activate(context: vscode.ExtensionContext) {

    // Register our custom editor providers
    if (+vscode.version.match(/1\.(\d+)/)![1] >= 45) {
        context.subscriptions.push(GeoJsonViewerProvider.register(context));

    }
    
}
