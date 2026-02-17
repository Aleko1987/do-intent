import { Service } from "encore.dev/service";

export default new Service("intent_scorer", {
  cors: {
    allowedOrigins: [
      "https://earthcurebiodiesel.com",
      "http://localhost:5173",
      "http://localhost:3000"
    ]
  }
});
