// One-time: tag existing morality pairs with foundations derived from their axis.
import { getDb } from '../server/db.js';
const db = getDb();
const F = new Set(['care','fairness','loyalty','authority','purity','liberty']);
const rows = db.prepare(`SELECT id, axis FROM pairs WHERE theme_id='morality' AND axis IS NOT NULL AND NOT EXISTS (SELECT 1 FROM entity_tags et WHERE et.entity_id=id)`).all() as {id:string,axis:string}[];
const upsertTag = db.prepare(`INSERT OR IGNORE INTO tags (id,label) VALUES (?,?)`);
const linkTag = db.prepare(`INSERT OR IGNORE INTO entity_tags (tag_id,entity_type,entity_id) VALUES (?,'pair',?)`);
let tagged=0;
db.transaction(()=>{ for(const r of rows){ const parts=r.axis.toLowerCase().split(/\s+vs\.?\s+/).map(s=>s.trim()).filter(p=>F.has(p)); if(parts.length===2){ for(const t of parts){ upsertTag.run(t,t); linkTag.run(t,r.id);} tagged++; } } })();
console.log(`  tagged ${tagged} of ${rows.length} untagged morality pairs`);
