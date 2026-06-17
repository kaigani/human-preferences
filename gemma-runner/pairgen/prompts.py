"""Generation templates. prompt_id selects the writer template."""
from __future__ import annotations

WRITER_TEMPLATE_V1 = """\
You generate A/B preference pairs that reveal a person's PERSONAL TASTE.

THEME: {theme_label}
CONTEXT SEED: {context}
CONTRAST AXIS (a hint, you may choose your own): {axis_hint}

Produce {n} distinct preference pairs. For EACH pair:
- "context": a short, specific question or situation (one sentence) the two
  options both answer. Vary these across the {n} pairs — different angles within
  the theme. Do NOT reuse the seed text verbatim.
- "option_a" and "option_b": two contrasting, one-sentence stances. BOTH must be
  genuinely appealing — a thoughtful person could sincerely prefer either. Never
  make one obviously right or strawman the other. No hedging, no "it depends".
- "axis": 2-5 words naming the contrast (e.g. "minimal vs ornate").
- "strength": your confidence from 0 to 1 that this is a clean, meaningful
  contrast of taste (not a false choice).

Keep statements crisp and evocative — this is about taste, not correctness.

Return ONLY a JSON object of this exact shape:
{{"pairs": [{{"context": "...", "option_a": "...", "option_b": "...", "axis": "...", "strength": 0.8}}]}}
"""

FORMATTER_TEMPLATE = """\
Convert the following into a single valid JSON object of the shape
{{"pairs": [{{"context": "...", "option_a": "...", "option_b": "...", "axis": "...", "strength": 0.8}}]}}.
Output ONLY the JSON, no prose, no code fences.

INPUT:
{raw}
"""

OPINION_STANCE_V1 = """\
Below is a real post from an online community ({theme_label}). Use it as raw
material to elicit a person's PERSONAL TASTE / OPINION — not the "correct" answer.

POST:
{context}

Produce {n} distinct A/B preference pairs provoked by this post. For EACH pair:
- "context": a short one-sentence framing of the specific question of judgment
  this post raises (your words, not a quote).
- "option_a" and "option_b": two opposed but each-defensible opinionated stances
  a thoughtful person could hold on that question. Both must be reasonable; do
  not strawman either. These reveal values, not facts.
- "axis": 2-5 words naming the underlying values contrast.
- "strength": 0..1 confidence this is a genuine values contrast (not a factual right/wrong).

Return ONLY JSON of this exact shape:
{{"pairs": [{{"context": "...", "option_a": "...", "option_b": "...", "axis": "...", "strength": 0.8}}]}}
"""

NARRATIVE_PICK_V1 = """\
You generate "which would you rather experience?" preference pairs about CULTURE
({theme_label}) — film, television, books, music, or games.

CATEGORY SEED: {context}
CONTRAST HINT (optional): {axis_hint}

Produce {n} distinct pairs. For EACH pair:
- "context": a short framing like "Which would you rather watch tonight?" (fit the category).
- "option_a" and "option_b": two REAL, well-known works in this category, each with a
  one-line evocative hook ("Title — hook."). Pick works that genuinely contrast in mood,
  era, or sensibility so the choice reveals taste. Both must be appealing; this is about
  pull, not quality. Vary your picks widely across the {n} pairs.
- "axis": 2-5 words naming the taste contrast (e.g. "contemplative vs kinetic").
- "strength": 0..1 confidence this is a clean taste contrast.

Return ONLY JSON: {{"pairs": [{{"context": "...", "option_a": "...", "option_b": "...", "axis": "...", "strength": 0.8}}]}}
"""

ROLE_PLAY_V1 = """\
You generate situational ROLE-PLAY preference pairs that reveal personal values.

ROLE / SITUATION SEED: {context}
CONTRAST HINT (optional): {axis_hint}

Produce {n} distinct pairs. For EACH pair:
- "context": a vivid SECOND-PERSON setup — "You're a [role]. [a specific call you must make]."
  Put the reader inside the role with a concrete stake. Vary the situation across the {n} pairs.
- "option_a"/"option_b": two choices the person could make, each genuinely defensible, revealing
  values (loyalty vs standards, mercy vs rules, speed vs care, the person vs the numbers…). No strawman.
- "axis": 2-5 words naming the values contrast.
- "strength": 0..1.

Span a REAL RANGE of professions — trades, care, service, field, enterprise, not just office or
academic roles (construction, nursing, kitchens, farms, shops, trucking, classrooms…).

Return ONLY JSON: {{"pairs": [{{"context":"...","option_a":"...","option_b":"...","axis":"...","strength":0.8}}]}}
"""

OPINION_STANCE_V2 = """\
Below is a real post from an online community ({theme_label}). Use it as raw
material to put a reader INSIDE the situation and elicit their PERSONAL VALUES —
not the "correct" answer.

POST:
{context}

Produce {n} distinct A/B preference pairs provoked by this post. For EACH pair:
- "context": a vivid SECOND-PERSON setup that drops the reader into the dilemma the
  post raises — "You're a [role/person] and [the concrete situation]. [the question
  you face]." Make them feel the stake. Do NOT write an abstract "whether X is worth
  Y" proposition, and do not quote the post.
- "option_a"/"option_b": two opposed, each-defensible choices the person in that
  situation could make, in a confident first-person or imperative voice. Both
  reasonable; no strawman. These reveal values, not facts.
- "axis": 2-5 words naming the values contrast.
- "strength": 0..1 confidence this is a genuine values contrast (not factual right/wrong).

Return ONLY JSON: {{"pairs": [{{"context":"...","option_a":"...","option_b":"...","axis":"...","strength":0.8}}]}}
"""

WRITERS = {
    "stance_contrast_v1": WRITER_TEMPLATE_V1,
    "opinion_stance_v1": OPINION_STANCE_V1,
    "opinion_stance_v2": OPINION_STANCE_V2,
    "narrative_pick_v1": NARRATIVE_PICK_V1,
    "role_play_v1": ROLE_PLAY_V1,
}


def writer_prompt(prompt_id: str, *, theme_label: str, context: str, axis_hint: str, n: int) -> str:
    template = WRITERS.get(prompt_id, WRITER_TEMPLATE_V1)
    return template.format(
        theme_label=theme_label or "general",
        context=context,
        axis_hint=axis_hint or "(choose a meaningful one)",
        n=n,
    )


def formatter_prompt(raw: str) -> str:
    return FORMATTER_TEMPLATE.format(raw=raw)
