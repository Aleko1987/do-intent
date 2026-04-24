import { Service } from "encore.dev/service";
import { runMigrationsIfEnabled } from "../db/bootMigrations.js";

void runMigrationsIfEnabled();

export default new Service("health");
