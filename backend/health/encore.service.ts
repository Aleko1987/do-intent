import { Service } from "encore.dev/service";
import { runMigrationsIfEnabled } from "../db/bootMigrations.js";

await runMigrationsIfEnabled();

export default new Service("health");
