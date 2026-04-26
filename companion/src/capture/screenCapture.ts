import { nativeImage, screen } from "electron";
import screenshot from "screenshot-desktop";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureResult {
  dataUrl: string;
  mimeType: "image/png" | "image/jpeg";
  capturedAt: string;
}

function toDataUrl(buffer: Buffer, mimeType: "image/png" | "image/jpeg"): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function maybeCompress(buffer: Buffer, maxBytes: number): CaptureResult {
  let image = nativeImage.createFromBuffer(buffer);
  let png = image.toPNG();
  if (png.byteLength <= maxBytes) {
    return { dataUrl: toDataUrl(png, "image/png"), mimeType: "image/png", capturedAt: new Date().toISOString() };
  }

  const size = image.getSize();
  const resized = image.resize({
    width: Math.max(640, Math.floor(size.width * 0.75)),
    height: Math.max(360, Math.floor(size.height * 0.75)),
  });
  const jpeg = resized.toJPEG(80);
  return { dataUrl: toDataUrl(jpeg, "image/jpeg"), mimeType: "image/jpeg", capturedAt: new Date().toISOString() };
}

export async function captureFullscreen(options: {
  allMonitors: boolean;
  maxBytes: number;
}): Promise<CaptureResult> {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const buffer = await screenshot({ format: "png", screen: options.allMonitors ? "all" : display.id.toString() });
  return maybeCompress(buffer, options.maxBytes);
}

export async function captureRegion(options: {
  rect: Rect;
  maxBytes: number;
}): Promise<CaptureResult> {
  const display = screen.getDisplayNearestPoint({ x: options.rect.x, y: options.rect.y });
  const buffer = await screenshot({ format: "png", screen: display.id.toString() });
  const image = nativeImage.createFromBuffer(buffer);
  const displayBounds = display.bounds;
  const localRect = {
    x: Math.max(0, options.rect.x - displayBounds.x),
    y: Math.max(0, options.rect.y - displayBounds.y),
    width: Math.max(1, options.rect.width),
    height: Math.max(1, options.rect.height),
  };
  const cropped = image.crop(localRect).toPNG();
  return maybeCompress(cropped, options.maxBytes);
}
