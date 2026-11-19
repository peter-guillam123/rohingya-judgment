# Rohingya judgment explainer

An interactive article explaining the International Court of Justice
judgment of 19 November 2026 in The Gambia v Myanmar.

Audience: general readers, most of whom do not know when or where this happened
Voice: sober explainer - third person, plain English, every finding attributed to the court, Myanmar's case stated fairly, no first person
Design: its own look - dark, quiet, typographic. No Guardian fonts, colours or logo

## Rules for this project

- Two PDFs in this folder are the only sources: the judgment
  (`...-jud-01-00-en.pdf`) and the joint dissenting opinion of six judges
  (`...-jud-01-03-en.pdf`), added on 19 November 2026 at the editor's request.
  Nothing goes in the article that is not in one of them. The other 16
  individual opinions and declarations are not sources; ask before adding
  any. The ICJ site blocks automated downloads, so the editor saves the PDFs by hand.
- Every factual claim carries the paragraph number it comes from: "para
  253" for the judgment, "dissent, para 12" for the dissent. Run
  `python3 tools/check_facts.py` after any copy change: it checks each
  quoted phrase and figure against the cited paragraphs.
- Keep the two voices apart. What the court found is "the court". What
  the minority said is "the six" or "the dissent", and stays in its own
  section and in the one summary point at the top.
- Graphic testimony stays behind a warned panel the reader chooses to
  open. The main read states findings plainly without the worst detail.
- Coastlines and borders come from Natural Earth (public domain). Village
  positions are read off the court's sketch-map No. 1 and are approximate.
  Township lines are traced by eye from the same map. Say so on the page.
- Public since 19 November 2026, by the editor's decision: repo
  `peter-guillam123/rohingya-judgment`, live on GitHub Pages, with a card
  on the index site. Pushes to `main` deploy. The page keeps its
  `noindex` tag until told otherwise. No lawyer has read it yet.
