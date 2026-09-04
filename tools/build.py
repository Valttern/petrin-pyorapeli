#!/usr/bin/env python3
"""Upottaa assets/*.png data-URI:na index.html-tiedostoon merkkien /*ASSETS-START*/ ... /*ASSETS-END*/ väliin.
  python3 tools/build.py          # upota
  python3 tools/build.py --clear  # tyhjennä upotus (peli piirtää kaiken ohjelmallisesti)
  python3 tools/build.py --out dev.html   # kirjoita upotettu versio toiseen tiedostoon (kehitystestaus), index.html ei muutu
"""
import base64, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "index.html"
MANIFEST = json.loads((ROOT / "tools" / "assets.json").read_text(encoding="utf-8"))
META_P = ROOT / "assets" / "meta.json"
META = json.loads(META_P.read_text()) if META_P.exists() else {}
START, END = "/*ASSETS-START*/", "/*ASSETS-END*/"

def main():
    html = HTML.read_text(encoding="utf-8")
    i, j = html.index(START) + len(START), html.index(END)
    if "--clear" in sys.argv:
        payload = "window.ASSET_DATA={};"
    else:
        data = {}
        for a in MANIFEST["assets"]:
            for ext, mime in (("png", "image/png"), ("jpg", "image/jpeg")):
                p = ROOT / "assets" / f"{a['name']}.{ext}"
                if p.exists():
                    d = {"src": f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode(),
                         "worldH": a.get("worldH"), "kind": a["kind"]}
                    m = META.get(a["name"])
                    if m: d.update(m)
                    if a.get("anchors"): d["anchors"] = a["anchors"]
                    data[a["name"]] = d
                    break
        audio_manifest = ROOT / "tools" / "audio.json"
        if audio_manifest.exists():
            am = json.loads(audio_manifest.read_text(encoding="utf-8"))
            for tr in am["tracks"] + [dict(v, loop=False) for v in am.get("voices", [])]:
                p = ROOT / "assets" / "audio" / f"{tr['name']}.mp3"
                if p.exists():
                    data[tr["name"]] = {"src": "data:audio/mpeg;base64," + base64.b64encode(p.read_bytes()).decode(), "kind": "audio", "loop": bool(tr.get("loop"))}
        payload = "window.ASSET_DATA=" + json.dumps(data, separators=(",", ":")) + ";"
        print(f"upotettu {len(data)} assettia, {sum(len(v['src']) for v in data.values())//1024} KB base64")
    out = HTML
    if "--out" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--out") + 1])
        if not out.is_absolute(): out = ROOT / out
    out.write_text(html[:i] + payload + html[j:], encoding="utf-8")
    print(f"{out.name} {out.stat().st_size//1024} KB")

if __name__ == "__main__":
    main()
