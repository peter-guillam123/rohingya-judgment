"""Cut Natural Earth (public domain) down to the small map file the article loads.
Usage: python3 -I tools/build_map.py tools/_cache/ne data/map.json
"""
import json, sys, os

src, out = sys.argv[1], sys.argv[2]
VIEW = (78.0, 3.0, 114.0, 34.0)  # lon0, lat0, lon1, lat1 - the widest view the article shows

def load(name):
    with open(os.path.join(src, name), encoding="utf-8") as f:
        return json.load(f)["features"]

def rings_of(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    return geom["coordinates"]

def bbox(ring):
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    return min(xs), min(ys), max(xs), max(ys)

def hits(b, v=VIEW):
    return not (b[2] < v[0] or b[0] > v[2] or b[3] < v[1] or b[1] > v[3])

def tidy(ring, nd):
    o = []
    for x, y in ring:
        p = [round(x, nd), round(y, nd)]
        if not o or o[-1] != p:
            o.append(p)
    return o

def polys(geom, nd, min_pts=4, outer_only=False):
    res = []
    for poly in rings_of(geom):
        if not hits(bbox(poly[0])):
            continue
        rs = [tidy(r, nd) for r in (poly[:1] if outer_only else poly)]
        rs = [r for r in rs if len(r) >= min_pts]
        if rs:
            res.append(rs)
    return res

c50 = load("ne_50m_admin_0_countries.geojson")
c10 = load("ne_10m_admin_0_countries.geojson")
a1 = load("ne_10m_admin_1_states_provinces.geojson")

DETAIL = {"Myanmar", "Bangladesh"}
countries = []
for f in c50:
    name = f["properties"]["ADMIN"]
    if name in DETAIL:
        continue
    b = None
    ps = polys(f["geometry"], 2, min_pts=6, outer_only=True)
    if ps:
        countries.append({"name": name, "polys": ps})
for f in c10:
    name = f["properties"]["ADMIN"]
    if name in DETAIL:
        countries.append({"name": name, "polys": polys(f["geometry"], 3, outer_only=True)})

rakhine = None
for f in a1:
    p = f["properties"]
    if p.get("admin") == "Myanmar" and p.get("name") == "Rakhine":
        rakhine = polys(f["geometry"], 3, outer_only=True)
assert rakhine, "Rakhine State not found"

data = {
    "source": "Natural Earth, public domain (naturalearthdata.com). 1:10m for Myanmar, Bangladesh and Rakhine State; 1:50m elsewhere.",
    "countries": countries,
    "rakhine": rakhine,
}
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8") as f:
    json.dump(data, f, separators=(",", ":"))
n = sum(len(r) for c in countries for p in c["polys"] for r in p)
print(len(countries), "countries,", n, "points,", os.path.getsize(out) // 1024, "KB")
print(sorted(c["name"] for c in countries))
print("rakhine polys", len(rakhine), sum(len(r) for p in rakhine for r in p))
