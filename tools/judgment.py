"""Read the judgment PDF and split it into its numbered paragraphs.

Paragraph 0 is everything before paragraph 1 (title pages, the bench, counsel).
Paragraph 646 runs to the end, so it includes the votes and the list of opinions.
"""
import glob, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", "_cache", "judgment.txt")
LAST = 646


def raw_text():
    if os.path.exists(CACHE):
        return open(CACHE, encoding="utf-8").read()
    import fitz  # PyMuPDF

    pdfs = glob.glob(os.path.join(ROOT, "*.pdf"))
    assert len(pdfs) == 1, "expected exactly one PDF (the judgment) in the project folder"
    doc = fitz.open(pdfs[0])
    text = "\n".join(page.get_text() for page in doc)
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    open(CACHE, "w", encoding="utf-8").write(text)
    return text


def paragraphs():
    lines = []
    for line in raw_text().split("\n"):
        s = line.strip()
        if re.fullmatch(r"- \d+ -", s) or re.fullmatch(r"- [ivx]+ -", s):
            continue  # page numbers
        lines.append(s)
    paras, cur, want = {0: []}, 0, 1
    started = False
    for s in lines:
        if not started:
            if s.startswith("1. On 11 November 2019"):
                started = True
            else:
                paras[0].append(s)
                continue
        m = re.match(r"^(\d{1,3})\. (.*)", s)
        if m and int(m.group(1)) == want and want <= LAST:
            cur = want
            paras[cur] = [m.group(2)]
            want += 1
        else:
            paras[cur].append(s)
    assert want == LAST + 1, f"found only {want - 1} paragraphs"
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
