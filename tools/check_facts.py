"""Check the article against the judgment.

For every block of text in index.html and about.html this checks that:
  1. every figure in it appears in the paragraph(s) of the judgment it cites;
  2. every quotation in it appears word for word in those paragraphs;
  3. no block with a figure in it goes without a citation;
  4. the table of votes matches the judgment's operative clause.

It is a net, not a judge: it catches wrong numbers, misquotes and wrong paragraph
references. It cannot tell whether a sentence fairly sums up what the court said.

Usage: python3 tools/check_facts.py [-v]
"""
import os, re, sys
from html.parser import HTMLParser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from judgment import paragraphs, norm, numbers, have, ROOT
from build_votes import clauses, JUDGES

BLOCKS = {"p", "li", "dd", "dt", "td", "th", "caption", "footer", "summary", "time",
          "h1", "h2", "h3", "h4", "legend", "figcaption"}
STOP = {"section", "main", "body", "header", "article", "html", "nav"}
VOID = {"meta", "link", "br", "img", "input", "hr", "source", "wbr"}
SKIP = {"script", "style", "title", "head", "noscript"}


class Node:
    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.parent, self.kids = tag, dict(attrs), parent, []

    def has_class(self, c):
        return c in self.attrs.get("class", "").split()

    def walk(self):
        yield self
        for k in self.kids:
            if isinstance(k, Node):
                yield from k.walk()

    def text(self, own_block_only=False, skip_refs=True):
        out = []
        for k in self.kids:
            if isinstance(k, str):
                out.append(k)
            elif k.tag in SKIP or (skip_refs and k.tag == "cite" and k.has_class("ref")):
                continue
            elif own_block_only and k.tag in BLOCKS | {"blockquote", "table", "ul", "ol", "dl", "div", "details"}:
                continue
            else:
                out.append(k.text(own_block_only, skip_refs))
        return "".join(out)

    def ancestors(self):
        n = self.parent
        while n:
            yield n
            n = n.parent


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root", [], None)
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur)
        self.cur.kids.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_endtag(self, tag):
        n = self.cur
        while n and n.tag != tag:
            n = n.parent
        if n and n.parent:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.kids.append(data)


def parse_refs(node):
    """Paragraph numbers from every <cite class="ref"> inside a node."""
    out = set()
    for n in node.walk():
        if n.tag == "cite" and n.has_class("ref") and not n.has_class("ref--demo"):
            t = n.text(skip_refs=False).strip()
            # "para 253" cites the judgment; "dissent, para 12" cites the joint dissenting opinion
            m = re.fullmatch(r"(?:(dissent), )?paras? ([\d, –-]+)", t)
            if not m:
                raise ValueError(f"cannot read citation: {t!r}")
            src = m.group(1) or "judgment"
            for part in re.split(r",\s*", m.group(2)):
                r = re.fullmatch(r"(\d+)[–-](\d+)", part.strip())
                if r:
                    out.update((src, k) for k in range(int(r.group(1)), int(r.group(2)) + 1))
                else:
                    out.add((src, int(part)))
    return out


def refs_for(block):
    """A block's own citations; failing that, those of the nearest enclosing element that has any."""
    own = parse_refs(block)
    if "data-para" in block.attrs:  # 0 stands for the title pages, which have no paragraph number
        own |= {("judgment", int(x)) for x in block.attrs["data-para"].split(",")}
    # an enclosing element can add paragraphs that every block inside it also rests on
    for a in block.ancestors():
        if "data-para" in a.attrs:
            extra = {("judgment", int(x)) for x in a.attrs["data-para"].split(",")}
            if own:
                return own | extra, False
            break
    if own:
        return own, False
    for a in block.ancestors():
        if "data-para" in a.attrs:
            return {("judgment", int(x)) for x in a.attrs["data-para"].split(",")}, True
        if a.tag == "blockquote":
            r = parse_refs(a)
            if not r and a.parent:
                sibs = [k for k in a.parent.kids if isinstance(k, Node)]
                i = sibs.index(a)
                if i + 1 < len(sibs):
                    r = parse_refs(sibs[i + 1])
            if r:
                return r, True
        if a.tag in STOP:
            break
        r = parse_refs(a)
        if r:
            return r, True
    return set(), False


def nofact(block):
    return any("data-nofact" in n.attrs for n in [block, *block.ancestors()])


def quote_ok(q, hay):
    q = norm(q).strip(" .,;:")
    if not q:
        return True
    pos = 0
    for seg in [s.strip(" .,;:") for s in q.split("…")]:
        if not seg:
            continue
        i = hay.find(seg, pos)
        if i < 0:
            return False
        pos = i + len(seg)
    return True


def check_file(path, paras, verbose):
    t = Tree()
    t.feed(open(path, encoding="utf-8").read())
    errors, checked_n, checked_q, blocks, derived = [], 0, 0, 0, []
    name = os.path.basename(path)
    for b in t.root.walk():
        if b.tag not in BLOCKS or nofact(b):
            continue
        if any(a.tag in SKIP for a in b.ancestors()):
            continue
        own = b.text(own_block_only=True)
        if not own.strip():
            continue
        # figures marked as derived are listed, not checked
        dtext = ""
        for n in b.walk():
            if "data-derived" in n.attrs:
                derived.append((name, n.text().strip(), n.attrs["data-derived"]))
                dtext += " " + n.text()
        nums = numbers(own) - numbers(dtext)
        quotes = [n.text() for n in b.walk() if n.tag == "q"]
        quotes += re.findall(r"“([^”]+)”", own)
        if b.tag == "p" and any(a.tag == "blockquote" for a in b.ancestors()):
            quotes.append(own)
        if not nums and not quotes:
            continue
        try:
            refs, inherited = refs_for(b)
        except ValueError as e:
            errors.append(f"{name}: {e}")
            continue
        snippet = re.sub(r"\s+", " ", own).strip()[:90]
        if not refs:
            errors.append(f"{name}: NO CITATION for a block with figures or quotes: {snippet!r}")
            continue
        bad = [r for r in refs if r not in paras]
        if bad:
            errors.append(f"{name}: cites paragraphs that do not exist {bad}: {snippet!r}")
            continue
        blocks += 1
        src = " ".join(paras[r] for r in sorted(refs))
        src_nums, src_norm = numbers(src), norm(src)
        for n in sorted(nums):
            checked_n += 1
            if n not in src_nums:
                errors.append(f"{name}: figure {n} is not in para(s) {sorted(refs)}: {snippet!r}")
        for q in quotes:
            checked_q += 1
            if not quote_ok(q, src_norm):
                errors.append(f"{name}: quote not found in para(s) {sorted(refs)}: {q.strip()[:100]!r}")
        if verbose:
            print(f"  ok  {sorted(refs)}{' (inherited)' if inherited else ''}  {snippet}")
    return errors, checked_n, checked_q, blocks, derived, t


def check_votes(tree):
    errors = []
    table = next((n for n in tree.root.walk() if n.attrs.get("id") == "votetable"), None)
    if table is None:
        return ["index.html: votes table missing"]
    rows = [n for n in table.walk() if n.tag == "tr"][1:]
    cl = clauses()
    if len(rows) != len(cl):
        return [f"votes table has {len(rows)} rows, judgment has {len(cl)} clauses"]
    for row, (n, how, f, a) in zip(rows, cl):
        cells = [k for k in row.kids if isinstance(k, Node) and k.tag == "td"]
        got = [c.text().strip() for c in cells[1:]]
        want = ["F" if j in f else "A" for j, _ in JUDGES]
        if got != want:
            errors.append(f"votes table row {n} does not match the judgment")
    return errors


def main():
    verbose = "-v" in sys.argv
    paras = {("judgment", k): v for k, v in paragraphs().items()}
    if have("dissent"):
        d = paragraphs("dissent")
        paras.update({("dissent", k): v for k, v in d.items()})
        print(f"joint dissenting opinion: {len(d) - 1} paragraphs read")
    total_err = []
    for f in ["index.html", "about.html"]:
        p = os.path.join(ROOT, f)
        if not os.path.exists(p):
            continue
        errs, n, q, blocks, derived, tree = check_file(p, paras, verbose)
        print(f"{f}: {blocks} cited blocks, {n} figures and {q} quotations checked, {len(errs)} problems")
        for d in derived:
            print(f"  derived, not in the judgment as such: {d[1]!r} - {d[2]}")
        total_err += errs
        if f == "index.html":
            v = check_votes(tree)
            print(f"votes table: {'matches para 646' if not v else 'MISMATCH'}")
            total_err += v
    for e in total_err:
        print("  ✗", e)
    print("PASS" if not total_err else f"FAIL: {len(total_err)} problems")
    sys.exit(1 if total_err else 0)


if __name__ == "__main__":
    main()
