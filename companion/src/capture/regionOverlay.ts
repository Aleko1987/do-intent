import { BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Rect } from "./screenCapture.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let overlayWindow: BrowserWindow | null = null;

export async function selectRegion(): Promise<Rect | null> {
  if (overlayWindow) {
    console.warn("[companion] overlay already active");
    return null;
  }

  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const bounds = display.bounds;

  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    movable: false,
    resizable: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
    },
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.webContents.on("console-message", (_event, level, message) => {
    console.info("[overlay]", { level, message });
  });
  overlayWindow.webContents.on("did-fail-load", (_event, code, desc) => {
    console.error("[overlay] failed to load", { code, desc });
  });
  await overlayWindow.loadFile(path.join(__dirname, "../renderer/region-overlay.html"));
  console.info("[companion] region overlay loaded");

  return await new Promise<Rect | null>((resolve) => {
    const onComplete = (_event: unknown, rect: Rect | null) => {
      cleanup();
      if (!rect) {
        console.info("[companion] overlay complete with null rect");
        resolve(null);
        return;
      }
      console.info("[companion] overlay complete rect", rect);
      resolve({
        x: rect.x + bounds.x,
        y: rect.y + bounds.y,
        width: rect.width,
        height: rect.height,
      });
    };
    const onCancel = () => {
      console.info("[companion] overlay cancel event");
      cleanup();
      resolve(null);
    };
    const cleanup = () => {
      ipcMain.off("region-overlay-complete", onComplete);
      ipcMain.off("region-overlay-cancel", onCancel);
      if (overlayWindow) {
        overlayWindow.close();
        overlayWindow = null;
      }
    };

    ipcMain.on("region-overlay-complete", onComplete);
    ipcMain.on("region-overlay-cancel", onCancel);
    overlayWindow?.once("closed", () => {
      console.info("[companion] overlay window closed");
      ipcMain.off("region-overlay-complete", onComplete);
      ipcMain.off("region-overlay-cancel", onCancel);
      overlayWindow = null;
      resolve(null);
    });
  });
}
