import { Service } from "encore.dev/service";
import { api } from "encore.dev/api";

export default new Service("frontend");

interface FrontendResponse {
  message: string;
}

// Temporary placeholder endpoints to keep Encore schema generation stable.
export const appRoot = api<{}, FrontendResponse>(
  { expose: true, method: "GET", path: "/app" },
  async () => ({ message: "frontend disabled in api build" })
);