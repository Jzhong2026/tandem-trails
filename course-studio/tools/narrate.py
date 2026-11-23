"""Build the bundled MP3 narration and scene timings from the lesson scripts.

Generation only: pip install edge-tts. The local player needs only Node.js.
Run this program from any directory; all staging stays in the repository's tmp/.
"""
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import re

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
STAGING = ROOT.parent / "tmp" / "course-narration"
MEDIA = ROOT / "media"
INDEX = MEDIA / "index.json"


def narration_key(lesson):
    return hashlib.sha256("\n".join(s["say"] for s in lesson["scenes"]).encode()).hexdigest()[:16]


def spoken(text, subject):
    if subject != "math":
        return text
    text = re.sub(r"(?<![\d/])(\d+)\s*/\s*(\d+)(?![\d/])", r"\2分之\1", text)
    text = re.sub(r"(\d+(?:\.\d+)?)%", r"百分之\1", text)
    for a, b in [("cm²", "平方厘米"), ("m²", "平方米"), ("cm³", "立方厘米"),
                 ("m³", "立方米"), ("×", "乘以"), ("÷", "除以"), ("＋", "加"),
                 ("+", "加"), ("−", "减"), ("＝", "等于"), ("=", "等于"),
                 ("≤", "小于或等于"), ("≥", "大于或等于"), ("<", "小于"), (">", "大于")]:
        text = text.replace(a, b)
    return re.sub(r"(?<=\d)\s*-\s*(?=\d)", "减", text)


async def record(text, attempts=5):
    for attempt in range(attempts):
        try:
            mp3 = bytearray()
            captions = []
            voice = edge_tts.Communicate(text, "zh-CN-XiaoxiaoNeural", rate="-4%", boundary="SentenceBoundary")
            async for part in voice.stream():
                if part["type"] == "audio":
                    mp3.extend(part["data"])
                elif part["type"] == "SentenceBoundary":
                    captions.append([round(part["offset"] / 1e7, 3), part["text"]])
            # edge-tts supplies raw 24 kHz mono MPEG-2 Layer III, CBR 48 kb/s.
            # Each 24 ms frame occupies exactly 144 bytes, without tags.
            if not mp3 or len(mp3) % 144 or any(mp3[i:i+2] != b"\xff\xf3" for i in range(0, len(mp3), 144)):
                raise ValueError("Unexpected MPEG frame format")
            return mp3, round(len(mp3) / 6000, 3), captions
        except Exception:
            if attempt + 1 == attempts:
                raise
            await asyncio.sleep(min(30, 2 ** (attempt + 1)))


def save_index(index):
    tmp = STAGING / "index.pending.json"
    tmp.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, INDEX)


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=5)
    parser.add_argument("--subject", choices=["chinese", "english", "math"])
    args = parser.parse_args()
    STAGING.mkdir(parents=True, exist_ok=True)
    MEDIA.mkdir(exist_ok=True)
    index = json.loads(INDEX.read_text("utf-8")) if INDEX.exists() else {}
    queue = asyncio.Queue()
    for subject in ([args.subject] if args.subject else ["chinese", "math", "english"]):
        source = ROOT / "content" / (subject + ".json")
        if not source.exists():
            continue
        for lesson in json.loads(source.read_text("utf-8-sig")):
            key = narration_key(lesson)
            if index.get(lesson["id"], {}).get("key") != key or not (MEDIA / (lesson["id"] + ".mp3")).exists():
                queue.put_nowait((subject, lesson, key))
    count = queue.qsize()
    finished = 0
    errors = []

    async def worker():
        nonlocal finished
        while not queue.empty():
            subject, lesson, key = queue.get_nowait()
            lesson_id = lesson["id"]
            try:
                audio = bytearray()
                durations, captions = [], []
                for scene in lesson["scenes"]:
                    data, length, cues = await record(spoken(scene["say"], subject))
                    audio.extend(data)
                    durations.append(length)
                    captions.append(cues)
                tmp = STAGING / (lesson_id + ".pending.mp3")
                tmp.write_bytes(audio)
                os.replace(tmp, MEDIA / (lesson_id + ".mp3"))
                index[lesson_id] = {"key": key, "durations": durations, "captions": captions}
                finished += 1
                if finished % 12 == 0:
                    save_index(index)
                    print(f"{finished}/{count} recordings ready", flush=True)
            except Exception as error:
                errors.append(lesson_id)
                print(lesson_id, repr(error), flush=True)

    await asyncio.gather(*(worker() for _ in range(max(1, args.workers))))
    save_index(index)
    print(f"Recorded {finished}/{count} lessons; indexed {len(index)}.", flush=True)
    if errors:
        raise SystemExit("Retry failed lessons: " + ", ".join(errors))


if __name__ == "__main__":
    asyncio.run(main())
