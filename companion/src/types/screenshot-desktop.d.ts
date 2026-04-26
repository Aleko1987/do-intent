declare module "screenshot-desktop" {
  interface ScreenshotOptions {
    format?: "png" | "jpg" | "jpeg";
    screen?: string;
  }

  export default function screenshot(options?: ScreenshotOptions): Promise<Buffer>;
}
