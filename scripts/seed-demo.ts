// Hand-seed demo pairs so the judging loop works before any generator exists.
// Idempotent: dedups on content_hash. Run: `npm run seed:demo`
import { nanoid } from 'nanoid';
import { getDb, migrate } from '../server/db.js';
import { pairContentHash } from '../shared/hash.js';

const db = getDb();
migrate(db);

type DemoPair = { theme: string; context: string; axis: string; a: string; b: string };

const DEMO: DemoPair[] = [
  // ── design ──
  { theme: 'design', context: 'A guiding principle for a landing page.', axis: 'minimal vs ornate', a: 'Simplicity that speaks.', b: 'Details that whisper.' },
  { theme: 'design', context: 'How a product should feel on first use.', axis: 'obvious vs discoverable', a: 'Everything where you expect it.', b: 'Rewards that reveal themselves over time.' },
  { theme: 'design', context: 'The role of whitespace.', axis: 'density vs air', a: 'Generous space; let it breathe.', b: 'Pack it in; every pixel earns its place.' },
  { theme: 'design', context: 'Typography stance for a serious brand.', axis: 'classic vs expressive', a: 'A quiet, timeless serif.', b: 'A bold display face with personality.' },
  { theme: 'design', context: 'Color strategy.', axis: 'restraint vs saturation', a: 'A near-monochrome palette with one accent.', b: 'Confident, saturated color throughout.' },
  { theme: 'design', context: 'Motion and animation.', axis: 'still vs kinetic', a: 'Mostly still; motion only to clarify.', b: 'Lively motion that gives the UI life.' },
  { theme: 'design', context: 'Iconography.', axis: 'literal vs abstract', a: 'Plain, instantly legible icons.', b: 'Distinctive, slightly abstract marks.' },
  { theme: 'design', context: 'How to handle errors.', axis: 'honest vs gentle', a: 'Say exactly what went wrong, plainly.', b: 'Soften it; protect the moment.' },
  { theme: 'design', context: 'Default vs customization.', axis: 'opinionated vs flexible', a: 'One great default, few choices.', b: 'Deep customization for power users.' },
  { theme: 'design', context: 'Photography vs illustration for a hero.', axis: 'real vs drawn', a: 'A single, striking photograph.', b: 'A custom illustration with a point of view.' },
  { theme: 'design', context: 'Density of a data table.', axis: 'comfortable vs compact', a: 'Roomy rows that are easy to scan.', b: 'Compact rows that show more at once.' },
  { theme: 'design', context: 'Borders vs shadows for separation.', axis: 'flat vs layered', a: 'Hairline borders; flat and crisp.', b: 'Soft shadows; gentle depth.' },

  // ── living ──
  { theme: 'living', context: 'How to spend a free Saturday.', axis: 'planned vs open', a: 'A loose day with nothing scheduled.', b: 'A full itinerary of good things.' },
  { theme: 'living', context: 'The ideal home.', axis: 'minimal vs collected', a: 'Few objects, each one chosen.', b: 'Layers of books, art, and memory.' },
  { theme: 'living', context: 'A good morning.', axis: 'slow vs productive', a: 'Coffee, quiet, no agenda.', b: 'Up early, momentum before the world wakes.' },
  { theme: 'living', context: 'How to cook dinner.', axis: 'precise vs intuitive', a: 'Follow the recipe exactly.', b: 'Taste and improvise as you go.' },
  { theme: 'living', context: 'Where to live.', axis: 'city vs nature', a: 'Dense city, everything walkable.', b: 'Space, trees, and quiet.' },
  { theme: 'living', context: 'On owning things.', axis: 'few-fine vs many-useful', a: 'A few excellent things you keep for years.', b: 'Whatever is useful, replaced freely.' },
  { theme: 'living', context: 'A meal with friends.', axis: 'intimate vs lively', a: 'Four people and a long conversation.', b: 'A loud table full of people.' },
  { theme: 'living', context: 'How to travel.', axis: 'deep vs broad', a: 'One place, slowly, until it feels like home.', b: 'Many places, a taste of each.' },
  { theme: 'living', context: 'Relationship to technology at home.', axis: 'connected vs unplugged', a: 'Always reachable, frictionless.', b: 'Deliberate distance from screens.' },
  { theme: 'living', context: 'The shape of a week.', axis: 'routine vs variety', a: 'Steady rhythms you can rely on.', b: 'No two days the same.' },
  { theme: 'living', context: 'Saving vs spending on experiences.', axis: 'security vs experience', a: 'Save first; freedom is the luxury.', b: 'Spend on the trip; memories compound.' },

  // ── power ──
  { theme: 'power', context: 'How leaders should hold authority.', axis: 'visible vs invisible', a: 'Lead from the front, clearly in charge.', b: 'Set the conditions and step back.' },
  { theme: 'power', context: 'Source of real influence.', axis: 'position vs trust', a: 'Formal authority and title.', b: 'Earned trust regardless of rank.' },
  { theme: 'power', context: 'How decisions should be made.', axis: 'decisive vs consensus', a: 'One person decides and owns it.', b: 'The group aligns before moving.' },
  { theme: 'power', context: 'Ambition.', axis: 'driven vs content', a: 'Always reaching for the next thing.', b: 'Enough is a place you can arrive at.' },
  { theme: 'power', context: 'On institutions.', axis: 'reform vs preserve', a: 'Tear down what no longer works.', b: 'Protect what took generations to build.' },
  { theme: 'power', context: 'How to win an argument.', axis: 'force vs persuasion', a: 'Press the strongest point hard.', b: 'Give ground to gain agreement.' },
  { theme: 'power', context: 'Status signals.', axis: 'loud vs quiet', a: 'Show what you have earned.', b: 'The quietest in the room has nothing to prove.' },
  { theme: 'power', context: 'Risk and a career.', axis: 'bold vs steady', a: 'Bet big; fortune favors nerve.', b: 'Compound small, safe gains.' },
  { theme: 'power', context: 'Accountability when things fail.', axis: 'own vs distribute', a: 'The leader takes the blame alone.', b: 'The system failed; fix the system.' },
  { theme: 'power', context: 'Mentorship vs autonomy for talent.', axis: 'guide vs release', a: 'Coach closely; shape the path.', b: 'Hand them the keys and trust them.' },
  { theme: 'power', context: 'Negotiation posture.', axis: 'competitive vs cooperative', a: 'Claim the most you can.', b: 'Grow the pie, then split it.' },

  // ── culture ──
  { theme: 'culture', context: 'What art should do.', axis: 'comfort vs provoke', a: 'Console us; offer beauty and rest.', b: 'Unsettle us; force us to look.' },
  { theme: 'culture', context: 'The canon.', axis: 'tradition vs reinvention', a: 'Master the classics first.', b: 'Break from them to make something new.' },
  { theme: 'culture', context: 'A great story.', axis: 'plot vs character', a: 'A tight, surprising plot.', b: 'People so real you forget the plot.' },
  { theme: 'culture', context: 'High vs popular culture.', axis: 'refined vs vital', a: 'The refined, the rare, the difficult.', b: 'What millions actually love.' },
  { theme: 'culture', context: 'How to judge taste.', axis: 'universal vs personal', a: 'Some things are simply better.', b: 'Taste is yours alone to set.' },
  { theme: 'culture', context: 'Endings.', axis: 'resolved vs open', a: 'Tie it up; give us closure.', b: 'Leave it open; let us wonder.' },
  { theme: 'culture', context: 'A film’s pace.', axis: 'patient vs propulsive', a: 'Slow, observed, allowed to breathe.', b: 'Relentless forward momentum.' },
  { theme: 'culture', context: 'Sincerity vs irony.', axis: 'earnest vs ironic', a: 'Mean it, fully, without a wink.', b: 'Hold it at a knowing distance.' },
  { theme: 'culture', context: 'Preserving vs remixing culture.', axis: 'archive vs remix', a: 'Keep the original sacred.', b: 'Cut it up and make it yours.' },
  { theme: 'culture', context: 'Difficulty in art.', axis: 'accessible vs demanding', a: 'Welcome everyone in.', b: 'Reward those who work for it.' },
  { theme: 'culture', context: 'The point of criticism.', axis: 'celebrate vs scrutinize', a: 'Champion what deserves attention.', b: 'Hold work to a hard standard.' },
  { theme: 'culture', context: 'Novelty vs craft.', axis: 'new vs well-made', a: 'Show me something I’ve never seen.', b: 'Show me something made perfectly.' },
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO pairs
    (id, schema_version, theme_id, context, content_type,
     option_a, option_b, generator_provider, generator_model,
     generator_prompt_id, generation_strength, axis, content_hash, status)
  VALUES
    (@id, 1, @theme_id, @context, 'text',
     @option_a, @option_b, 'manual', NULL,
     'demo_seed_v1', NULL, @axis, @content_hash, 'queued')
`);

const insertMany = db.transaction((rows: DemoPair[]) => {
  let added = 0;
  for (const r of rows) {
    const content_hash = pairContentHash(r.context, r.a, r.b);
    const info = insert.run({
      id: `pair_${nanoid(12)}`,
      theme_id: r.theme,
      context: r.context,
      option_a: r.a,
      option_b: r.b,
      axis: r.axis,
      content_hash,
    });
    added += info.changes;
  }
  return added;
});

const added = insertMany(DEMO);
const total = (db.prepare(`SELECT COUNT(*) AS n FROM pairs WHERE status='queued'`).get() as { n: number }).n;
console.log(`✓ Seeded ${added} new demo pair(s). Queue now holds ${total} pair(s) to judge.`);
