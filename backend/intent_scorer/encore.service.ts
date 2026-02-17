import { Service } from "encore.dev/service";

export const service = new Service("intent_scorer", {
  cors: {
    allowedOrigins: [
      "https://earthcurebiodiesel.com",
      "http://localhost:5173",
      "http://localhost:3000"
    ]
  }
});
