
import { $dbManager } from "../core/index.js";
import { runMigrations } from "../schema/index.js";

const db = $dbManager.registerDatabase('main', {
  path: './data/app.db',
  create: true
});

runMigrations(db);