"""Fill the votes table in index.html straight from the judgment's operative clause (para 646).

Usage: python3 tools/build_votes.py
"""
import html, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from judgment import paragraphs, ROOT

JUDGES = [("Iwasawa", "President"), ("Sebutinde", "Vice-president"), ("Tomka", ""), ("Abraham", ""),
          ("Xue", ""), ("Nolte", ""), ("Charlesworth", ""), ("Brant", ""), ("Gómez Robledo", ""),
          ("Cleveland", ""), ("Aurescu", ""), ("Tladi", ""), ("Hmoud", ""),
          ("Pillay", "Chosen by The Gambia"), ("Kress", "Chosen by Myanmar")]

# Plain-English labels for the 13 clauses. The wording of each clause is in para 646.
LABELS = [
    "Myanmar committed genocide against the Rohingya in northern Rakhine State",
    "Myanmar failed to prevent genocide by individuals acting alongside its security forces",
    "Myanmar did not directly and publicly incite private persons to commit genocide",
    "Myanmar failed to punish genocide and the related acts",
    "Myanmar failed to pass the laws the convention requires",
    "Myanmar must pass a law giving full effect to the convention",
    "Myanmar must investigate suspects and, if warranted, prosecute and punish them",
    "Myanmar must give assurances and guarantees that it will not happen again",
    "Myanmar must make restitution",
    "Myanmar must compensate the Rohingya where restitution falls short",
    "The court will settle the compensation, and Myanmar must report to it",
    "Myanmar broke the court's earlier order to preserve evidence",
    "All other requests by The Gambia are rejected",
]


def clauses():
    t = paragraphs()[646]
    parts = re.split(r"\((\d{1,2})\) (By [a-z]+ votes to [a-z]+|Unanimously),", t)
    out = []
    for i in range(1, len(parts), 3):
        n, how, body = int(parts[i]), parts[i + 1], parts[i + 2]
        if how == "Unanimously":
            out.append((n, how, [j for j, _ in JUDGES], []))
            continue
        fav = re.search(r"IN FAVOUR:(.*?)AGAINST:", body, re.S).group(1)
        ag = body.split("AGAINST:", 1)[1]
        f = [j for j, _ in JUDGES if j in fav]
        a = [j for j, _ in JUDGES if j in ag]
        assert len(f) + len(a) == 15 and not set(f) & set(a), (n, f, a)
        out.append((n, how, f, a))
    assert [c[0] for c in out] == list(range(1, 14)), [c[0] for c in out]
    return out


def table():
    cl = clauses()
    rows = ['<table class="votetable" id="votetable">',
            '<caption>How each judge voted on each question. F means in favour, A means against. '
            '<cite class="ref">para 646</cite></caption>',
            '<thead><tr><th scope="col">Question</th><th scope="col">Vote</th>']
    for j, role in JUDGES:
        r = f' data-role="{html.escape(role)}"' if role else ""
        rows.append(f'<th scope="col"{r}>{html.escape(j)}</th>')
    rows.append("</tr></thead><tbody>")
    for (n, how, f, a), label in zip(cl, LABELS):
        tally = "Unanimous" if how == "Unanimously" else f"{len(f)}–{len(a)}"
        rows.append(f'<tr><th scope="row"><span class="qn">{n}.</span> {html.escape(label)}</th>'
                    f'<td class="tally">{tally}</td>')
        for j, _ in JUDGES:
            v = "F" if j in f else "A"
            rows.append(f'<td data-v="{v}">{v}</td>')
        rows.append("</tr>")
    rows.append("</tbody></table>")
    return "\n".join(rows), cl


if __name__ == "__main__":
    t, cl = table()
    p = os.path.join(ROOT, "index.html")
    s = open(p, encoding="utf-8").read()
    s2 = re.sub(r"<!-- votes:start -->.*?<!-- votes:end -->",
                lambda m: "<!-- votes:start -->\n" + t + "\n<!-- votes:end -->", s, flags=re.S)
    open(p, "w", encoding="utf-8").write(s2)
    for n, how, f, a in cl:
        print(n, how, len(f), len(a), "| against:", ", ".join(a))
