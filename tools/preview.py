#!/usr/bin/env python3
"""Kokoaa assets/*.png -kuvista kontaktiarkin shakkilautataustalle tarkistusta varten."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parent.parent
M = json.loads((ROOT / "tools" / "assets.json").read_text(encoding="utf-8"))
out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "assets" / "contact.jpg"
CELL = 220
def checker(w, h, s=12):
    im = Image.new("RGB", (w, h), (205, 205, 205)); d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if ((x // s) + (y // s)) % 2: d.rectangle([x, y, x + s - 1, y + s - 1], fill=(160, 160, 160))
    return im
names = [a["name"] for a in M["assets"] if (ROOT / "assets" / f"{a['name']}.png").exists()]
cols = 6; rows = (len(names) + cols - 1) // cols
sheet = Image.new("RGB", (cols * CELL, rows * (CELL + 18)), (30, 30, 30)); d = ImageDraw.Draw(sheet)
for i, n in enumerate(names):
    im = Image.open(ROOT / "assets" / f"{n}.png").convert("RGBA")
    s = min((CELL - 10) / im.width, (CELL - 10) / im.height, 1.0)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    bg = checker(CELL - 4, CELL - 4); bg.paste(im, ((bg.width - im.width) // 2, (bg.height - im.height) // 2), im)
    x, y = (i % cols) * CELL, (i // cols) * (CELL + 18)
    sheet.paste(bg, (x + 2, y + 2)); d.text((x + 6, y + CELL + 2), n, fill=(230, 230, 230))
sheet.save(out, quality=82); print(out, sheet.size, len(names), "kuvaa")
