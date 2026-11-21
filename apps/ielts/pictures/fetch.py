"""Finds candidate pictures for each word (runs in GitHub Actions, which can reach these sites).

search:   free photos from Wikimedia Commons and Openverse -> candidates/<slug>/c<N>.jpg + meta.json
generate: a drawn picture from Pollinations, only for words with no suitable photo -> candidates/<slug>/g<N>.jpg
Words that already have a candidates folder are skipped, so the script can run again safely.
"""
import io, json, os, re, sys, time, urllib.parse, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "candidates")
UA = "WordADayPictureBot/1.0 (https://github.com/MuhsinaOtahonova/IELTS-Vocab)"

def slug(w): return re.sub(r"[^a-z0-9]+", "-", w.lower()).strip("-")

def get(url, timeout=40):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), r.headers.get("Content-Type", "")

def save_jpg(data, path, size=480):
    im = Image.open(io.BytesIO(data)).convert("RGB")
    im.thumbnail((size, size))
    im.save(path, "JPEG", quality=82)
    return im

def strip_html(s): return re.sub(r"<[^>]+>", "", s or "").strip()

def commons(q, n):
    url = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6"
           f"&gsrlimit={n*2}&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=480&gsrsearch="
           + urllib.parse.quote(q + " filetype:bitmap"))
    data = json.loads(get(url)[0])
    pages = sorted((data.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
    out = []
    for p in pages:
        ii = (p.get("imageinfo") or [{}])[0]
        if ii.get("mime") not in ("image/jpeg", "image/png", "image/webp"): continue
        md = ii.get("extmetadata") or {}
        out.append({"thumb": ii.get("thumburl"), "page": ii.get("descriptionurl"), "title": p.get("title"),
                    "credit": " · ".join(x for x in [strip_html(md.get("Artist", {}).get("value"))[:60], md.get("LicenseShortName", {}).get("value")] if x) + " · Wikimedia Commons"})
        if len(out) >= n: break
    return out

def openverse(q, n):
    url = "https://api.openverse.org/v1/images/?mature=false&page_size=%d&q=%s" % (n, urllib.parse.quote(q))
    data = json.loads(get(url)[0])
    return [{"thumb": r.get("thumbnail") or r.get("url"), "page": r.get("foreign_landing_url"), "title": r.get("title"),
             "credit": " · ".join(x for x in [(r.get("creator") or "")[:60], (r.get("license") or "").upper(), r.get("source")] if x)} for r in data.get("results", [])]

def is_limit_placeholder(im):
    # Pollinations' "Free limit reached" card is a flat pale yellow picture.
    small = im.resize((32, 32)).getdata()
    yellow = sum(1 for (r, g, b) in small if r > 220 and 190 < g < 235 and 90 < b < 160)
    return yellow > 0.6 * 32 * 32

def run():
    cfg = json.load(open(os.path.join(HERE, "queries.json")))
    os.makedirs(OUT, exist_ok=True)
    for word, queries in cfg.get("search", {}).items():
        d = os.path.join(OUT, slug(word))
        if os.path.exists(os.path.join(d, "meta.json")): continue
        os.makedirs(d, exist_ok=True)
        found = []
        for q in queries:
            for src, fn, n in (("commons", commons, 4), ("openverse", openverse, 3)):
                try:
                    found += fn(q, n)
                except Exception as e:
                    print("  !", word, src, e, file=sys.stderr)
                time.sleep(1.2)
        meta, seen = [], set()
        for c in found:
            if not c.get("thumb") or c["thumb"] in seen: continue
            seen.add(c["thumb"])
            name = f"c{len(meta)+1}.jpg"
            try:
                save_jpg(get(c["thumb"])[0], os.path.join(d, name))
            except Exception as e:
                print("  ! download", word, e, file=sys.stderr); continue
            meta.append({**c, "file": name})
            if len(meta) >= 12: break
        json.dump(meta, open(os.path.join(d, "meta.json"), "w"), indent=1, ensure_ascii=False)
        print(word, len(meta))
    for word, prompt in cfg.get("generate", {}).items():
        d = os.path.join(OUT, slug(word))
        os.makedirs(d, exist_ok=True)
        metaf = os.path.join(d, "gen.json")
        meta = json.load(open(metaf)) if os.path.exists(metaf) else []
        if any(m.get("prompt") == prompt for m in meta): continue
        seed = 7 + len(meta)
        url = ("https://image.pollinations.ai/prompt/" + urllib.parse.quote(prompt + ". soft colours, plain light background, no text, no letters")
               + f"?width=512&height=512&nologo=true&seed={seed}")
        for attempt in range(4):
            try:
                data, ctype = get(url, timeout=120)
                im = Image.open(io.BytesIO(data)).convert("RGB")
                if is_limit_placeholder(im): raise RuntimeError("free limit placeholder")
                name = f"g{len(meta)+1}.jpg"
                save_jpg(data, os.path.join(d, name), 512)
                meta.append({"file": name, "prompt": prompt, "seed": seed, "credit": "Drawn with Pollinations (AI)"})
                json.dump(meta, open(metaf, "w"), indent=1)
                print("drawn", word)
                break
            except Exception as e:
                print("  ! gen", word, e, file=sys.stderr)
                time.sleep(60)
        time.sleep(50)

if __name__ == "__main__":
    run()
