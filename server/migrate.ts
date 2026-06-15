// Standalone migration runner: `npm run db:migrate`
import { DB_PATH, getDb, migrate } from './db.js';

const ran = migrate(getDb());
if (ran.length === 0) {
  console.log(`✓ Database up to date — ${DB_PATH}`);
} else {
  console.log(`✓ Applied ${ran.length} migration(s) to ${DB_PATH}:`);
  for (const f of ran) console.log(`  • ${f}`);
}
