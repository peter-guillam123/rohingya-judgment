"""Turn positions read off the court's sketch-map No. 1 (judgment p. 62) into longitude/latitude.

The pixel positions below were read by eye from a 220-dpi render of that page, so
every position is approximate. The sketch-map prints its own graticule (Mercator,
92 15'E / 92 30'E / 92 45'E and 21 15'N ... 20 15'N), which fixes the conversion.
Township lines are simplified traces of the same map. Polygons deliberately
overshoot into the sea and into Bangladesh: the page only tints the part that
falls on Myanmar's land.

Usage: python3 -I tools/build_places.py data/geo.json
"""
import json, math, sys

X0, LON0, PX_PER_DEG = 571.0, 92.25, 1316.0      # 92 15'E sits at x=571
Y0, LAT0 = 695.0, 21.25                           # 21 15'N sits at y=695
K = PX_PER_DEG * 180.0 / math.pi

def merc(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))

def ll(p):
    x, y = p
    lon = LON0 + (x - X0) / PX_PER_DEG
    m = merc(LAT0) - (y - Y0) / K
    lat = math.degrees(2 * math.atan(math.exp(m)) - math.pi / 2)
    return [round(lon, 4), round(lat, 4)]

PLACES = {
    "min-gyi": (677, 849),
    "chut-pyin": (1085, 1647),
    "maung-nu": (940, 1115),
    "gu-dar-pyin": (960, 1390),
    "inn-din": (1014, 1737),
    "koe-tan-kauk": (1097, 1839),
    "chein-khar-li": (1107, 1868),
    "kyauk-pan-du": (958, 1684),
    "ah-lel-than-kyaw": (825, 1493),
    "myin-hlut": (903, 1561),
    "kha-maung-seik": (605, 666),
}
TOWNS = {
    "Maungdaw": (726, 1298),
    "Buthidaung": (933, 1220),
    "Rathedaung": (1237, 1767),
}

JUNCTION = (1000, 1600)
MB = [(818, 528), (820, 600), (795, 608), (775, 635), (750, 648), (730, 672), (705, 700),
      (698, 745), (708, 775), (728, 800), (740, 860), (750, 910), (760, 960), (762, 1000),
      (765, 1060), (770, 1110), (790, 1150), (810, 1200), (840, 1270), (865, 1330),
      (900, 1395), (915, 1430), (940, 1480), (965, 1520), (985, 1570), JUNCTION]
MR = [JUNCTION, (1018, 1625), (1050, 1670), (1070, 1700), (1085, 1735), (1098, 1770),
      (1102, 1788), (1085, 1802), (1065, 1813)]
BR = [JUNCTION, (1050, 1578), (1095, 1560), (1090, 1480), (1083, 1425), (1130, 1418), (1190, 1395)]
B_EAST = [(1140, 645), (1150, 670), (1180, 700), (1200, 740), (1195, 760), (1195, 900),
          (1205, 920), (1215, 950), (1225, 1000), (1228, 1025), (1160, 1040), (1158, 1105),
          (1175, 1190), (1195, 1220), (1185, 1300), (1195, 1360), (1182, 1392), (1190, 1395)]
R_EAST = [(1190, 1395), (1250, 1390), (1265, 1400), (1270, 1500), (1280, 1540), (1305, 1580),
          (1320, 1640), (1350, 1690), (1375, 1735), (1360, 1785), (1380, 1845), (1390, 1875),
          (1345, 1900), (1340, 1960), (1375, 2010), (1330, 2075), (1245, 2095), (1250, 2300)]

TOWNSHIPS = {
    "Maungdaw": MB + MR[1:] + [(1000, 1900), (300, 1900), (300, 300), (818, 300)],
    "Buthidaung": MB[::-1] + [(818, 480), (990, 480), (1060, 600)] + B_EAST + BR[::-1][1:],
    "Rathedaung": BR + R_EAST[1:] + [(1050, 2300), (1000, 1950)] + MR[::-1][:-1],
}

out = {
    "note": "Positions read by eye from the court's sketch-map No. 1. Approximate.",
    "places": {k: ll(v) for k, v in PLACES.items()},
    "towns": {k: ll(v) for k, v in TOWNS.items()},
    "townships": {k: [ll(p) for p in v] for k, v in TOWNSHIPS.items()},
    "lines": {"mb": [ll(p) for p in MB], "mr": [ll(p) for p in MR], "br": [ll(p) for p in BR],
              "east": [ll(p) for p in B_EAST + R_EAST[1:-1]]},
}
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(out, f, separators=(",", ":"))
for k, v in out["places"].items():
    print(f"{k:18s} {v}")
for k, v in out["towns"].items():
    print(f"{k:18s} {v}")
