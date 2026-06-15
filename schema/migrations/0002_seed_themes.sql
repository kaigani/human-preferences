-- Seed the four abstract themes from the product concept. Idempotent.
INSERT OR IGNORE INTO themes (id, label, kind, description, sort_order) VALUES
  ('design',  'Design',  'abstract', 'Form, restraint, ornament, the made world.',          1),
  ('living',  'Living',  'abstract', 'Daily life, ritual, comfort, how a life is arranged.', 2),
  ('power',   'Power',   'abstract', 'Status, influence, institutions, ambition.',           3),
  ('culture', 'Culture', 'abstract', 'Art, taste, meaning, what a society values.',          4);
