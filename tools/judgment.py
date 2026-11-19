"""Read the court's documents and split each into its numbered paragraphs.

Two sources are known:
  judgment - the judgment itself (file name ends -jud-01-00-en.pdf)
  dissent  - the joint dissenting opinion of six judges (ends -jud-01-03-en.pdf)

Paragraph 0 of each is everything before its paragraph 1 (title pages and the like).
The judgment's paragraph 646 runs to the end, so it holds the votes and the list of opinions.
"""
import glob, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = {
    "judgment": {"file": "*-jud-01-00-en.pdf", "first": "1. On 11 November 2019", "last": 646},
    "dissent": {"file": "*-jud-01-03-en.pdf", "first": "1. ", "last": None},
}


def have(source):
    return bool(_find(source)) or os.path.exists(_cache(source))


def _cache(source):
    return os.path.join(ROOT, "tools", "_cache", source + ".txt")


def _find(source):
    pat = SOURCES[source]["file"]
    return glob.glob(os.path.join(ROOT, pat)) + glob.glob(os.path.join(ROOT, "*", pat))


def raw_text(source="judgment"):
    cache = _cache(source)
    if os.path.exists(cache):
        return open(cache, encoding="utf-8").read()
    import fitz  # PyMuPDF

    pdfs = _find(source)
    assert len(pdfs) == 1, f"expected exactly one PDF for the {source}, found {len(pdfs)}"
    doc = fitz.open(pdfs[0])
    text = "\n".join(page.get_text() for page in doc)
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    open(cache, "w", encoding="utf-8").write(text)
    return text


def paragraphs(source="judgment"):
    spec = SOURCES[source]
    lines = []
    for line in raw_text(source).split("\n"):
        s = line.strip()
        if re.fullmatch(r"- \d+ -", s) or re.fullmatch(r"- [ivx]+ -", s):
            continue  # page numbers
        lines.append(s)
    paras, cur, want = {0: []}, 0, 1
    started = False
    for s in lines:
        if not started:
            if s.startswith(spec["first"]):
                started = True
            else:
                paras[0].append(s)
                continue
        m = re.match(r"^(\d{1,3})\. (.*)", s)
        if m and int(m.group(1)) == want and (spec["last"] is None or want <= spec["last"]):
            cur = want
            paras[cur] = [m.group(2)]
            want += 1
        else:
            paras[cur].append(s)
    if spec["last"] is not None:
        assert want == spec["last"] + 1, f"found only {want - 1} paragraphs in the {source}"
    return {k: " ".join(x for x in v if x) for k, v in paras.items()}


WORDS = {"two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
         "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
         "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
         "twenty": 20}


def norm(s):
    """Flatten the things that differ between a PDF and a web page but do not change meaning."""
    s = s.replace(" ", " ").replace("‑", "-").replace("‐", "-")
    s = s.replace("–", "-").replace("—", "-").replace("⎯", "-")
    s = re.sub(r"\. \. \.", "…", s)
    s = re.sub(r"[‘’“”\"']", "", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip().lower()


def numbers(s):
    """Every figure in a passage: digits (commas dropped) and the words two to twenty."""
    s = s.replace(" ", " ")
    out = set()
    for m in re.finditer(r"\d[\d,]*(?:\.\d+)?", s):
        out.add(m.group(0).rstrip(",").replace(",", ""))
    for w in re.findall(r"[A-Za-z]+", s):
        if w.lower() in WORDS:
            out.add(str(WORDS[w.lower()]))
    return out
