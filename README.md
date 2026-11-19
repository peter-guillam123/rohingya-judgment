# The Rohingya genocide ruling, explained

An interactive guide to the International Court of Justice judgment of
19 November 2026 in The Gambia v Myanmar, for readers who have not
followed the case.

Read it: https://peter-guillam123.github.io/rohingya-judgment/

## What it covers

- What the court decided, in six points
- Where and when the events took place, on a map
- The nine places the court examined
- The scale: people shown as dots, villages as blocks
- Why the court called it genocide, and what it did not find
- How each of the 15 judges voted on each of the 13 questions
- Why six judges disagreed
- What the court ordered

## Sources

Two documents, both published by the court on 19 November 2026:

- the judgment
- the joint dissenting opinion of six judges

Nothing else. Every factual statement in the article ends with the
paragraph it rests on. The PDFs are not kept in this repository. They
are on the court's site: https://www.icj-cij.org/case/178/judgments

## How it is checked

`tools/check_facts.py` reads every block of text in the article and looks
up the paragraphs it cites. Each figure and each quotation must appear in
them. The table of votes is built from the judgment's final paragraph.

To run it, save the two PDFs into this folder under their original names
(`178-20261119-jud-01-00-en.pdf` and `178-20261119-jud-01-03-en.pdf`),
install PyMuPDF, then:

```bash
python3 tools/check_facts.py
```

The script catches wrong numbers, misquotes and wrong references. It
cannot judge whether a sentence is a fair summary. Independent readers
did that; the About page says how. No lawyer has reviewed the article.

## Building

Plain HTML and CSS. The JavaScript in `src/` is bundled into
`dist/app.js`, which is committed, so the site runs as it stands.

```bash
pnpm install
```

```bash
pnpm run build
```

## Maps

Coastlines and borders are from Natural Earth (public domain). Village
positions and township lines were read by eye from the court's
sketch-map No. 1 and are approximate.
