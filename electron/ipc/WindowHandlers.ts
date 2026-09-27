import { ipcMain, BrowserWindow } from 'electron';
import type TabManager from '../TabManager';

/**
 * Registers window control IPC handlers
 */
export function register(mainWindow: BrowserWindow, tabManager: TabManager): void {
    // Minimize window
    ipcMain.on('window-minimize', () => {
        mainWindow.minimize();
    });

    // Toggle maximize/unmaximize
    ipcMain.on('window-maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });

    // Close window
    ipcMain.on('window-close', () => {
        mainWindow.close();
    });

    // Hide/show the web content views.
    // WebContentsViews are stacked on top of the renderer DOM, so renderer overlays
    // (popovers, the tab search palette) must detach them while they are open.
    // These channels were exposed in preload.ts but never had a handler, which made
    // every caller silently fail.
    ipcMain.on('hide-webview', () => {
        tabManager.hideAllViews();
    });

    ipcMain.on('show-webview', () => {
        tabManager.showAllViews();
    });
}
