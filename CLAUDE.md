# Rohingya judgment explainer

An interactive article explaining the International Court of Justice
judgment of 19 November 2026 in The Gambia v Myanmar.

Audience: general readers, most of whom do not know when or where this happened
Voice: sober explainer - third person, plain English, every finding attributed to the court, Myanmar's case stated fairly, no first person
Design: its own look - dark, quiet, typographic. No Guardian fonts, colours or logo

## Rules for this project

- The judgment PDF in this folder is the only source. Nothing goes in the
  article that is not in it. The separate and dissenting opinions are not
  in the file, so the article cannot say why any judge voted as they did.
- Every factual claim carries the paragraph number it comes from. Run
  `python3 tools/check_facts.py` after any copy change: it checks each
  quoted phrase and figure against the judgment text.
- Graphic testimony stays behind a warned panel the reader chooses to
  open. The main read states findings plainly without the worst detail.
- Coastlines and borders come from Natural Earth (public domain). Village
  positions are read off the court's sketch-map No. 1 and are approximate.
  Township lines are traced by eye from the same map. Say so on the page.
- Not public. Ask before publishing anywhere.
