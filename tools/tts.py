"""Озвучка главы с метками: python tools/tts.py content/opt/ch03/narration.ru.json site/opt/ch03/audio/ru

narration.ru.json: {"voice": "...", "rate": "+0%", "beats": {"id": "текст с [[метка]] внутри"}}
Пишет <id>.mp3 и timings.js: window.TIMINGS = {id: {key, dur, marks: {метка: сек}, cues: [[сек, фраза]]}}.
Неизменённые шаги (тот же key) не перегенерируются.
"""
import asyncio, hashlib, json, os, re, subprocess, sys, pathlib
import edge_tts

SRC, OUT = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
cfg = json.loads(SRC.read_text(encoding="utf-8"))
VOICE, RATE = cfg.get("voice", "ru-RU-SvetlanaNeural"), cfg.get("rate", "+0%")
TJS = OUT / "timings.js"
old = {}
if TJS.exists():
    t = TJS.read_text(encoding="utf-8")
    old = json.loads(t[t.index("=") + 1:].rstrip().rstrip(";"))

MARK = re.compile(r"\[\[([A-Za-z0-9_]+)\]\]")


def parse(text):
    marks, clean, pos = {}, "", 0
    for m in MARK.finditer(text):
        clean += text[pos:m.start()]
        marks[m.group(1)] = len(clean)
        pos = m.end()
    clean += text[pos:]
    clean = re.sub(r"\s+", " ", clean)
    return clean, marks


def speakable(s):
    # то, что голос иначе прочтёт неверно
    return s.replace("ε", "эпсилон").replace("φ′", "фи штрих").replace("φ", "фи").replace("−", "минус ").replace("≤", "не больше").replace("≥", "не меньше")


async def synth(text, path):
    com = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    words, audio = [], bytearray()
    async for ch in com.stream():
        if ch["type"] == "audio":
            audio += ch["data"]
        elif ch["type"] == "WordBoundary":
            words.append((ch["offset"] / 1e7, ch["text"]))
    if not audio:
        raise RuntimeError("no audio")
    path.write_bytes(bytes(audio))
    return words


def dur_of(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return round(float(out.stdout.strip()), 3)


def align(sp, words):
    """Позиция каждого слова озвучки в произносимом тексте — по порядку."""
    low, res, cur = sp.lower(), [], 0
    for t, w in words:
        k = low.find(w.lower(), cur)
        if k < 0:
            continue
        res.append((t, k))
        cur = k + len(w)
    return res


SENT = re.compile(r"[^.!?…]+[.!?…]*\s*")


async def main():
    T = {}
    for bid, text in cfg["beats"].items():
        clean, _ = parse(text)
        sp, marks = parse(speakable(text))
        key = hashlib.sha1((VOICE + RATE + text).encode()).hexdigest()
        mp3 = OUT / f"{bid}.mp3"
        if old.get(bid, {}).get("key") == key and mp3.exists():
            T[bid] = old[bid]
            continue
        for attempt in range(4):
            try:
                words = await synth(sp, mp3)
                break
            except Exception as e:  # сеть
                if attempt == 3:
                    raise
                await asyncio.sleep(2 + attempt * 3)
        al = align(sp, words)
        dur = dur_of(mp3)

        def at(ch):
            for t, k in al:
                if k >= ch - 0.5:
                    return round(max(0, t - 0.05), 3)
            return round(dur - 0.2, 3)
        mk = {m: at(c) for m, c in marks.items()}
        cues = []
        ss = [m for m in SENT.finditer(sp) if m.group().strip()]
        ds = [m.group().strip() for m in SENT.finditer(clean) if m.group().strip()]
        if len(ss) != len(ds):
            ds = [m.group().strip() for m in ss]
        for m, seg in zip(ss, ds):
            cues.append([at(m.start()) if m.start() > 0 else 0.1, seg])
        T[bid] = {"key": key, "dur": dur, "marks": mk, "cues": cues}
        print(f"{bid:12} {dur:6.2f}s  marks={mk}", flush=True)
    TJS.write_text("window.TIMINGS = " + json.dumps(T, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
    print("total", round(sum(v["dur"] for v in T.values()) / 60, 1), "min")


asyncio.run(main())
