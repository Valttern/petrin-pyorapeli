#!/usr/bin/env python3
"""Generoi pelin musiikin OpenRouterin Lyria 3 -malleilla ja jälkikäsittelee ffmpeg:llä (häivytysten leikkaus, saumaton looppi,
äänenvoimakkuuden normalisointi, mp3 96 kbps). Ambienssi ja pelitehosteet syntetisoidaan pelissä WebAudiolla (ks. index.html).
  python3 tools/gen_audio.py              # generoi puuttuvat + jälkikäsittele
  python3 tools/gen_audio.py --only music_menu --force
  python3 tools/gen_audio.py --post       # vain jälkikäsittely assets/audio/raw -> assets/audio
  python3 tools/gen_audio.py --check      # pyytää Gemini-mallia kuvailemaan valmiit raidat (laadunvarmistus)
Avain: OPENROUTER_API_KEY tai .env. Hinnat: klippi (30 s) 0,04 $, kappale 0,08 $.
"""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "audio" / "raw"; OUT = ROOT / "assets" / "audio"
M = json.loads((ROOT / "tools" / "audio.json").read_text(encoding="utf-8"))

def load_key():
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key and (ROOT / ".env").exists():
        for line in (ROOT / ".env").read_text().splitlines():
            if line.strip().startswith("OPENROUTER_API_KEY="): key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key: sys.exit("OPENROUTER_API_KEY puuttuu")
    return key

def call_stream(key, model, prompt):
    body = {"model": model, "stream": True, "modalities": ["audio", "text"], "messages": [{"role": "user", "content": prompt}]}
    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "Accept": "text/event-stream",
                                          "HTTP-Referer": "https://claude.ai/code", "X-Title": "Petrin pyorapeli audio"})
    audio, usage = [], None
    with urllib.request.urlopen(req, timeout=900) as r:
        for raw in r:
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data:"): continue
            payload = line[5:].strip()
            if payload == "[DONE]": break
            try: obj = json.loads(payload)
            except Exception: continue
            if obj.get("usage"): usage = obj["usage"]
            for ch in obj.get("choices", []):
                a = (ch.get("delta") or {}).get("audio")
                if isinstance(a, dict) and a.get("data"): audio.append(a["data"])
    if not audio: raise RuntimeError("ei ääntä vastauksessa")
    return base64.b64decode("".join(audio)), usage

def call_voice(key, model, voice, prompt):
    body = {"model": model, "stream": True, "modalities": ["text", "audio"], "audio": {"voice": voice, "format": "pcm16"},        # suoratoisto sallii vain pcm16 (24 kHz mono)
            "messages": [{"role": "user", "content": prompt}]}
    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "Accept": "text/event-stream"})
    audio, usage = [], None
    with urllib.request.urlopen(req, timeout=300) as r:
        for raw in r:
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data:"): continue
            payload = line[5:].strip()
            if payload == "[DONE]": break
            try: obj = json.loads(payload)
            except Exception: continue
            if obj.get("usage"): usage = obj["usage"]
            for ch in obj.get("choices", []):
                a = (ch.get("delta") or {}).get("audio")
                if isinstance(a, dict) and a.get("data"): audio.append(a["data"])
    if not audio: raise RuntimeError("ei ääntä vastauksessa")
    return base64.b64decode("".join(audio)), usage

def generate_voice(v, key, force):
    raw = RAW / f"{v['name']}.wav"
    if raw.exists() and not force: return
    prompt = M["voice_persona"].format(style=v["style"], text=v["text"])
    for attempt in range(2):
        try:
            data, usage = call_voice(key, M["voice_model"], M["voice"], prompt)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", "-", str(raw)], input=data, check=True)
            print(f"  {v['name']:<14} {len(data)//1024} KB  cost ${(usage or {}).get('cost', 0):.4f}"); return
        except Exception as e:
            print(f"  {v['name']:<14} yritys {attempt+1} epäonnistui: {e}"); time.sleep(2)

def post_voice(v):
    raw = RAW / f"{v['name']}.wav"
    if not raw.exists(): return
    x, sr = decode(raw); a, b = loud_region(x, sr, win=0.05, drop_db=30)
    a = max(0.0, a - 0.05); b = min(len(x) / sr, b + 0.15)
    out = OUT / f"{v['name']}.mp3"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", f"atrim={a}:{b},asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=7,afade=t=out:st={max(0,b-a-0.08)}:d=0.08",
                    "-ar", "32000", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "48k", str(out)], check=True)
    print(f"  {v['name']:<14} {a:.2f}-{b:.2f} s  {out.stat().st_size//1024} KB")

def check_voices(key):
    for v in M.get("voices", []):
        p = OUT / f"{v['name']}.mp3"
        if not p.exists(): continue
        b64 = base64.b64encode(p.read_bytes()).decode()
        body = {"model": "google/gemini-2.5-flash", "messages": [{"role": "user", "content": [
            {"type": "text", "text": "Transcribe this short Finnish clip exactly (verbatim), then in one short sentence describe the speaker's tone and whether it sounds like a natural Finnish male voice. Expected line: \"" + v["text"] + "\". Finally answer MATCH or MISMATCH."},
            {"type": "input_audio", "input_audio": {"data": b64, "format": "mp3"}}]}]}
        req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=180) as r: d = json.load(r)
        print(f"== {v['name']}: " + d["choices"][0]["message"]["content"].strip().replace("\n", " ")[:300])

def generate(t, key, force):
    raw = RAW / f"{t['name']}.mp3"
    if raw.exists() and not force: return
    model = M["clip_model"] if t["kind"] == "clip" else M["song_model"]
    for attempt in range(2):
        try:
            t0 = time.time(); data, usage = call_stream(key, model, t["prompt"]); raw.write_bytes(data)
            print(f"  {t['name']:<11} {model}  {len(data)//1024} KB  {time.time()-t0:.0f} s  cost ${(usage or {}).get('cost', 0):.3f}"); return
        except Exception as e:
            print(f"  {t['name']:<11} yritys {attempt+1} epäonnistui: {e}"); time.sleep(3)

# ---------- jälkikäsittely ----------
def decode(path):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", "22050", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(pcm, np.float32), 22050

def loud_region(x, sr, win=0.1, drop_db=14):
    """Palauttaa [alku, loppu] sekunteina: alue, jossa RMS on korkeintaan drop_db alle raidan tyypillisen tason (leikkaa fade-in/out)."""
    n = int(sr * win); k = len(x) // n
    rms = np.sqrt((x[:k * n].reshape(k, n) ** 2).mean(axis=1) + 1e-12)
    ref = np.percentile(rms, 70); thr = ref * 10 ** (-drop_db / 20)
    idx = np.where(rms > thr)[0]
    if len(idx) == 0: return 0.0, k * win
    return idx[0] * win, (idx[-1] + 1) * win

def postprocess(t):
    raw = RAW / f"{t['name']}.mp3"
    if not raw.exists(): return
    x, sr = decode(raw); a, b = loud_region(x, sr)
    total = len(x) / sr
    if t.get("max_len"): b = min(b, a + t["max_len"])
    out = OUT / f"{t['name']}.mp3"
    if t.get("loop"):
        X = 2.5                                   # ristihäivytys: häntä sekoitetaan alkuun ja leikataan pois -> saumaton looppi
        if b - a < X * 3: print(f"  {t['name']}: liian lyhyt looppiin ({b-a:.1f} s)"); return
        D = b - a
        fc = (f"[0:a]atrim={a}:{a+D-X},asetpts=PTS-STARTPTS,afade=t=in:st=0:d={X}:curve=hsin[head];"
              f"[0:a]atrim={a+D-X}:{a+D},asetpts=PTS-STARTPTS,afade=t=out:st=0:d={X}:curve=hsin[tail];"
              f"[head][tail]amix=inputs=2:duration=first:normalize=0,loudnorm=I={t['lufs']}:TP=-1.5:LRA=11[o]")
    else:
        fc = f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=out:st={max(0,b-a-1.5)}:d=1.5,loudnorm=I={t['lufs']}:TP=-1.5:LRA=11[o]"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-filter_complex", fc, "-map", "[o]", "-ar", "44100", "-ac", "2",
                    "-codec:a", "libmp3lame", "-b:a", "96k", str(out)], check=True)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)], capture_output=True, text=True).stdout.strip() or 0)
    print(f"  {t['name']:<11} raaka {total:.1f} s, käytetty {a:.1f}-{b:.1f} s -> {dur:.1f} s  {out.stat().st_size//1024} KB")

def check(key):
    for t in M["tracks"]:
        p = OUT / f"{t['name']}.mp3"
        if not p.exists(): continue
        b64 = base64.b64encode(p.read_bytes()).decode()
        body = {"model": "google/gemini-2.5-flash", "messages": [{"role": "user", "content": [
            {"type": "text", "text": "Describe this music clip in 2-3 sentences (instruments, tempo, mood, vocals yes/no) and whether the loop point (end -> start) would sound seamless. Then rate 0-10 how well it matches this brief: " + t["prompt"]},
            {"type": "input_audio", "input_audio": {"data": b64, "format": "mp3"}}]}]}
        req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=300) as r: d = json.load(r)
        print(f"== {t['name']}: " + d["choices"][0]["message"]["content"].strip()[:700] + f"\n   (tarkistus ${d.get('usage',{}).get('cost',0):.4f})")

def main():
    args = sys.argv[1:]; only = set(args[args.index("--only") + 1].split(",")) if "--only" in args else None
    tracks = [t for t in M["tracks"] if not only or t["name"] in only]
    RAW.mkdir(parents=True, exist_ok=True)
    voices = [v for v in M.get("voices", []) if not only or v["name"] in only]
    if "--check" in args:
        key = load_key()
        if tracks and not only or (only and tracks): check(key)
        if voices: check_voices(key)
        return
    if "--post" not in args:
        key = load_key(); print(f"Generoidaan {len(tracks)} raitaa ja {len(voices)} repliikkiä")
        for t in tracks: generate(t, key, "--force" in args)
        for v in voices: generate_voice(v, key, "--force" in args)
    print("Jälkikäsittely")
    for t in tracks: postprocess(t)
    for v in voices: post_voice(v)

if __name__ == "__main__":
    main()
