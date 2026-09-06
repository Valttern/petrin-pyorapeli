#!/usr/bin/env python3
"""Generoi pelin assetit OpenRouterin kuvamallilla ja jälkikäsittele ne (chroma key, rajaus, skaalaus).

Käyttö:
  python3 tools/gen_assets.py            # generoi puuttuvat
  python3 tools/gen_assets.py --only spruce1,car
  python3 tools/gen_assets.py --force    # generoi kaikki uudestaan
  python3 tools/gen_assets.py --post     # vain jälkikäsittely assets/raw -> assets

Avain: ympäristömuuttuja OPENROUTER_API_KEY tai projektin juuren .env-tiedosto (OPENROUTER_API_KEY=...).
"""
import base64, json, os, sys, time, urllib.request, urllib.error
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "raw"
OUT = ROOT / "assets"
MANIFEST = json.loads((ROOT / "tools" / "assets.json").read_text(encoding="utf-8"))

def load_key():
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        env = ROOT / ".env"
        if env.exists():
            for line in env.read_text().splitlines():
                if line.strip().startswith("OPENROUTER_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        sys.exit("OPENROUTER_API_KEY puuttuu: vie ympäristömuuttujana tai kirjoita .env-tiedostoon.")
    return key

def build_prompt(a):
    if a.get("nostyle"):
        return a["prompt"]
    parts = [MANIFEST.get("styles", {}).get(a.get("style"), MANIFEST["style"])]   # per-asset tyyli (esim. "dusk")
    if a["kind"] in ("sprite",):
        parts.append(MANIFEST["sprite_rule"])
    parts.append(a["prompt"])
    return " ".join(parts)

def call_openrouter(key, model, prompt, aspect):
    body = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "modalities": ["image", "text"],
    }
    if aspect:
        body["image_config"] = {"aspect_ratio": aspect}
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "HTTP-Referer": "https://claude.ai/code", "X-Title": "Petrin pyorapeli assets"},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        data = json.load(r)
    msg = data["choices"][0]["message"]
    imgs = msg.get("images") or []
    if not imgs:
        raise RuntimeError("ei kuvaa vastauksessa: " + (msg.get("content") or "")[:200])
    url = imgs[0]["image_url"]["url"]
    b64 = url.split(",", 1)[1]
    usage = data.get("usage", {})
    return base64.b64decode(b64), usage

def generate(a, key, force):
    if a.get("from"):
        return False
    raw = RAW / f"{a['name']}.png"
    if raw.exists() and not force:
        return False
    prompt = build_prompt(a)
    models = [MANIFEST["model"], MANIFEST.get("fallback_model")]
    last = None
    for model in [m for m in models if m]:
        for attempt in range(2):
            try:
                png, usage = call_openrouter(key, model, prompt, a.get("aspect"))
                raw.write_bytes(png)
                cost = usage.get("cost")
                print(f"  {a['name']:<10} {model}  {len(png)//1024} KB" + (f"  cost ${cost:.4f}" if cost is not None else ""))
                return True
            except urllib.error.HTTPError as e:
                detail = e.read().decode(errors="replace")[:300]
                last = f"HTTP {e.code}: {detail}"
                # jos aspect_ratio ei kelpaa, yritä ilman
                if "aspect" in detail.lower() or "image_config" in detail.lower():
                    try:
                        png, usage = call_openrouter(key, model, prompt, None)
                        raw.write_bytes(png); print(f"  {a['name']:<10} {model} (ilman aspect) {len(png)//1024} KB"); return True
                    except Exception as e2:
                        last = str(e2)
                time.sleep(2)
            except Exception as e:
                last = str(e); time.sleep(2)
    print(f"  {a['name']:<10} EPÄONNISTUI: {last}")
    return False

# ---------- jälkikäsittely ----------
def chroma_key(img):
    """Magenta (#FF00FF) -> alpha. Palauttaa RGBA-kuvan puhdistetuilla reunoilla."""
    arr = np.asarray(img.convert("RGB")).astype(np.float32)
    mag = np.array([255.0, 0.0, 255.0])
    dist = np.sqrt(((arr - mag) ** 2).sum(axis=2))
    t0, t1 = 70.0, 190.0
    alpha = np.clip((dist - t0) / (t1 - t0), 0.0, 1.0)
    # un-premultiply magentaa vasten: pixel = a*fg + (1-a)*mag
    a3 = alpha[..., None]
    fg = np.where(a3 > 0.02, (arr - (1 - a3) * mag) / np.maximum(a3, 0.02), arr)
    fg = np.clip(fg, 0, 255)
    # jäännösmagentan poisto reunoilta: jos R ja B > G, painetaan niitä G:n suuntaan
    r, g, b = fg[..., 0], fg[..., 1], fg[..., 2]
    spill = np.clip((np.minimum(r, b) - g) / 255.0, 0, 1) * (1 - alpha) * 2
    fg[..., 0] = r - (r - g) * np.clip(spill, 0, 1)
    fg[..., 2] = b - (b - g) * np.clip(spill, 0, 1)
    out = np.dstack([fg, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")

def clean_alpha(img, lo=48, hi=200):
    """Poistaa chroma keyn jättämän haalean reunahalon: alpha < lo -> 0, lo..hi venytetään, > hi -> 255.
    Ilman tätä spriten alle jää kymmeniä lähes läpinäkyviä rivejä ja sprite näyttää leijuvan."""
    arr = np.asarray(img.convert("RGBA")).copy()
    a = arr[..., 3].astype(np.float32)
    a = np.clip((a - lo) / (hi - lo), 0.0, 1.0) * 255.0
    arr[..., 3] = a.astype(np.uint8)
    return Image.fromarray(arr, "RGBA")

def trim(img, pad=2, thresh=8):
    a = np.asarray(img)[..., 3]
    ys, xs = np.where(a > thresh)
    if len(xs) == 0:
        return img
    x0, x1, y0, y1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, img.width), max(ys.min() - pad, 0), min(ys.max() + pad + 1, img.height)
    return img.crop((x0, y0, x1, y1))

def sprite_meta(img, n=48):
    """Ankkurit pelille: foot = rungon juuren x (0..1 leveydestä) alimmilla kiinteillä riveillä,
    prof = yläreunan korkeusprofiili (0..1 spriten korkeudesta) n sarakkeessa -> törmäysmuoto."""
    a = np.asarray(img)[..., 3]
    h, w = a.shape
    solid = a > 128
    rows = np.where(solid.any(axis=1))[0]
    if len(rows) == 0:
        return {"foot": 0.5, "prof": [0.0] * n, "w": w, "h": h}
    bottom = rows.max()
    band = solid[max(0, bottom - max(2, int(h * 0.04))):bottom + 1]
    ys, xs = np.where(band)
    foot = float(xs.mean() / w) if len(xs) else 0.5
    prof = []
    for k in range(n):
        x0, x1 = int(k * w / n), max(int(k * w / n) + 1, int((k + 1) * w / n))
        col = solid[:, x0:x1].any(axis=1)
        top = np.argmax(col) if col.any() else h
        prof.append(round(max(0.0, (h - top) / h), 3))
    # pieni tasoitus, jotta yksittäiset piikit eivät heitä pyörää
    sm = [round(max(prof[i], (prof[max(0, i - 1)] + prof[i] + prof[min(n - 1, i + 1)]) / 3), 3) for i in range(n)]
    return {"foot": round(foot, 3), "prof": sm, "w": w, "h": h}

def shrink(img, max_w, max_h):
    s = min(max_w / img.width, max_h / img.height, 1.0)
    if s < 1.0:
        img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    return img

def save_png(img, path):
    # 8-bittinen paletti alpha-kanavalla säästää tilaa data-URI:ssa
    q = img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(path, optimize=True)

META = OUT / "meta.json"

def postprocess(a):
    if a.get("from"):
        return False                                   # johdettu pala: syntyy emospriten käsittelyssä
    raw = RAW / f"{a['name']}.png"
    if not raw.exists():
        return False
    img = Image.open(raw)
    kind = a["kind"]
    meta = None
    if kind == "sprite":
        img = chroma_key(img)
        img = clean_alpha(img, lo=8, hi=120) if a.get("soft") else clean_alpha(img)
        img = trim(img, pad=2, thresh=40 if a.get("soft") else 100)
        for r in a.get("erase", []):            # käsin merkityt alueet läpinäkyviksi (esim. mallin piirtämä ylimääräinen kampi)
            arr = np.asarray(img).copy(); h, w = arr.shape[:2]
            arr[int(r[1]*h):int(r[3]*h), int(r[0]*w):int(r[2]*w), 3] = 0
            img = Image.fromarray(arr, "RGBA")
        img = shrink(img, a.get("max", 512), a.get("max", 512))
        meta = sprite_meta(img)
    elif kind == "band":
        img = clean_alpha(chroma_key(img), lo=24, hi=160)
        img = trim(img, pad=0, thresh=100)
        img = shrink(img, 1536, 512)
    elif kind == "tile":
        # saumaton toisto: peilataan 2x2, jolloin reunat kohtaavat aina itsensä
        img = img.convert("RGB")
        if a.get("crop_top"):
            img = img.crop((0, int(img.height * a["crop_top"]), img.width, img.height))
        img = shrink(img, 512, 512)
        w, h = img.size
        if a.get("seamless") == "blend":
            # tasainen rakeinen tekstuuri (esim. graniitti): siirretään puolikkaan verran ja ristihäivytetään saumat,
            # jolloin toisto on saumaton ilman peilikuvia (peilaus tekisi kaleidoskooppikuvion)
            arr = np.asarray(img).astype(np.float32)
            rolled = np.roll(np.roll(arr, w // 2, axis=1), h // 2, axis=0)
            wx = np.clip(np.minimum(np.arange(w), w - 1 - np.arange(w)) / (w * 0.22), 0, 1)
            wy = np.clip(np.minimum(np.arange(h), h - 1 - np.arange(h)) / (h * 0.22), 0, 1)
            mask = (wy[:, None] * wx[None, :])[:, :, None]
            img = Image.fromarray(np.clip(arr * mask + rolled * (1 - mask), 0, 255).astype(np.uint8)).resize((768, 768), Image.LANCZOS)
        else:
            quad = Image.new("RGB", (w * 2, h * 2))
            quad.paste(img, (0, 0)); quad.paste(img.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
            quad.paste(img.transpose(Image.FLIP_TOP_BOTTOM), (0, h)); quad.paste(img.transpose(Image.ROTATE_180), (w, h))
            img = quad.resize((768, 768), Image.LANCZOS)
    elif kind == "portrait":
        img = shrink(img.convert("RGB"), 320, 320)
    elif kind == "art":
        img = shrink(img.convert("RGB"), 1280, 1280)
    for old in (OUT / f"{a['name']}.png", OUT / f"{a['name']}.jpg"):
        if old.exists(): old.unlink()
    if kind in ("tile", "portrait", "art"):
        out = OUT / f"{a['name']}.jpg"
        img.save(out, quality=80 if kind == "art" else 82, optimize=True)
    else:
        out = OUT / f"{a['name']}.png"
        save_png(img, out)
    if a.get("parts"):
        meta["parts"] = extract_parts(img, a, out)
        img = Image.open(out)           # torso ilman irrotettuja osia
    if meta is not None:
        allmeta = json.loads(META.read_text()) if META.exists() else {}
        allmeta[a["name"]] = meta
        META.write_text(json.dumps(allmeta, separators=(",", ":")))
    print(f"  {a['name']:<14} -> {img.width}x{img.height}  {out.stat().st_size//1024} KB" + (f"  foot={meta['foot']}" if meta else ""))
    return True

def poly_mask(size, poly):
    from PIL import ImageDraw
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon([(x * size[0], y * size[1]) for x, y in poly], fill=255)
    return np.asarray(m) > 0

def extract_parts(img, a, torso_out):
    """Irrottaa spritestä liikkuvat palat (esim. olkavarsi, kyynärvarsi) polygonien mukaan omiksi PNG:iksi
    ja tallentaa niiden nivelankkurit palan omissa normalisoiduissa koordinaateissa. Torsoon jäävä reikä
    täytetään "fill"-polygonin sisällä annetulla värillä (paidan alla oleva vartalo), muualta pyyhitään."""
    arr = np.asarray(img.convert("RGBA")).copy(); h, w = arr.shape[:2]
    allmeta = json.loads(META.read_text()) if META.exists() else {}
    union = np.zeros((h, w), bool); info = {}
    for part in a["parts"]:
        m = poly_mask((w, h), part["poly"])
        ys, xs = np.where(m & (arr[..., 3] > 0))
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        piece = arr.copy(); piece[~m, 3] = 0; piece = piece[y0:y1, x0:x1]
        save_png(Image.fromarray(piece, "RGBA"), OUT / f"{part['name']}.png")
        anchors = {k: [round((v[0] * w - x0) / (x1 - x0), 4), round((v[1] * h - y0) / (y1 - y0), 4)] for k, v in part["anchors"].items()}
        allmeta[part["name"]] = {"foot": 0.5, "prof": [], "w": int(x1 - x0), "h": int(y1 - y0), "anchors": anchors}
        info[part["name"]] = anchors
        if not part.get("keep"): union |= m
    for poly in a.get("erase_poly", []):
        union |= poly_mask((w, h), poly)
    if a.get("fill"):
        fm = poly_mask((w, h), a["fill"]["poly"]) & union
        arr[fm, :3] = a["fill"]["color"]; arr[fm, 3] = 255
        union &= ~fm
    arr[union, 3] = 0
    save_png(Image.fromarray(arr, "RGBA"), torso_out)
    META.write_text(json.dumps(allmeta, separators=(",", ":")))
    return info

def main():
    args = sys.argv[1:]
    force = "--force" in args
    only = None
    if "--only" in args:
        only = set(args[args.index("--only") + 1].split(","))
    assets = [a for a in MANIFEST["assets"] if not only or a["name"] in only]
    RAW.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
    if "--post" not in args:
        key = load_key()
        print(f"Generoidaan {len(assets)} assettia mallilla {MANIFEST['model']}")
        for a in assets:
            generate(a, key, force)
    print("Jälkikäsittely")
    for a in assets:
        postprocess(a)

if __name__ == "__main__":
    main()
