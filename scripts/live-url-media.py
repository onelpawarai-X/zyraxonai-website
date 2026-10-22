#!/usr/bin/env python3
"""Live check that the provider accepts media by URL, not only inline.

Starts a throwaway HTTP server holding a real, decodable WAV, then asks the
provider to transcribe it three ways:

  1. inline base64                       - the baseline that already worked
  2. an http URL to the throwaway server - the server must fetch it itself
  3. a dead URL                          - must fail loudly, never silently drop

Usage: python3 scripts/live-url-media.py [base-url] [model]
"""
import base64
import functools
import http.server
import json
import math
import os
import socketserver
import struct
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8787").rstrip("/")
MODEL = sys.argv[2] if len(sys.argv) > 2 else "zyraxon-apex"
ENDPOINT = f"{BASE}/api/public/zyraxon/v1/chat/completions"
MEDIA_PORT = int(os.environ.get("MEDIA_PORT", "8899"))


def make_wav() -> bytes:
    """A 0.5s 440 Hz tone at 8 kHz mono - small, real, and audibly a tone."""
    sr, seconds = 8000, 0.5
    n = int(sr * seconds)
    pcm = b"".join(struct.pack("<h", int(12000 * math.sin(2 * math.pi * 440 * i / sr))) for i in range(n))
    return (
        b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt "
        + struct.pack("<IHHIIHH", 16, 1, 1, sr, sr * 2, 2, 16)
        + b"data" + struct.pack("<I", len(pcm)) + pcm
    )


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(directory: str):
    handler = functools.partial(Quiet, directory=directory)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", MEDIA_PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def post(payload: dict, timeout: int = 240):
    req = urllib.request.Request(
        ENDPOINT, data=json.dumps(payload).encode(), headers={"content-type": "application/json"}
    )
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, round(time.time() - t, 1), r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, round(time.time() - t, 1), e.read().decode()


def content_of(raw: str):
    try:
        d = json.loads(raw)
    except Exception:
        return None, raw[:200]
    msg = ((d.get("choices") or [{}])[0].get("message")) or {}
    return msg.get("content"), (d.get("error") or {}).get("message")


fails = 0
tmp = tempfile.mkdtemp(prefix="zyp-media-")
wav = make_wav()
with open(os.path.join(tmp, "tone.wav"), "wb") as f:
    f.write(wav)
httpd = serve(tmp)
url = f"http://127.0.0.1:{MEDIA_PORT}/tone.wav"
print(f"== {BASE} model={MODEL} ==")
print(f"serving {url} ({len(wav)} bytes)\n")

st, secs, raw = post({"model": MODEL, "messages": [{"role": "user", "content": [
    {"type": "text", "text": "What sound is in this clip? Answer in one short sentence."},
    {"type": "input_audio", "input_audio": {"data": base64.b64encode(wav).decode(), "format": "wav"}},
]}]})
c, err = content_of(raw)
print(f"[1 inline ] HTTP {st} {secs}s content={(c or '')[:90]!r} err={err}")
fails += 0 if (st == 200 and c) else 1

st, secs, raw = post({"model": MODEL, "messages": [{"role": "user", "content": [
    {"type": "text", "text": "What sound is in this clip? Answer in one short sentence."},
    {"type": "input_audio", "input_audio": {"url": url}},
]}]})
c, err = content_of(raw)
print(f"[2 url    ] HTTP {st} {secs}s content={(c or '')[:90]!r} err={err}")
fails += 0 if (st == 200 and c) else 1

st, secs, raw = post({"model": MODEL, "messages": [{"role": "user", "content": [
    {"type": "text", "text": "Describe this."},
    {"type": "image_url", "image_url": {"url": "http://127.0.0.1:9/definitely-missing.png"}},
]}]})
c, err = content_of(raw)
loud = st == 400 and err and "remote media" in err.lower()
print(f"[3 dead   ] HTTP {st} {secs}s err={err}")
fails += 0 if loud else 1

httpd.shutdown()
print(f"\n{'ALL LIVE URL CHECKS PASSED' if not fails else str(fails) + ' CHECK(S) FAILED'}")
sys.exit(1 if fails else 0)
