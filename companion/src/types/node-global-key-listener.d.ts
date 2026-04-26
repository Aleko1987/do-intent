declare module "node-global-key-listener" {
  export interface GlobalKeyEvent {
    name: string;
    state: "UP" | "DOWN";
  }

  export class GlobalKeyboardListener {
    addListener(handler: (event: GlobalKeyEvent, down: Record<string, boolean>) => void): void;
    removeListener(handler: (event: GlobalKeyEvent, down: Record<string, boolean>) => void): void;
  }
}
