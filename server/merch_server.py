"""Общая база merch и прокси к OpenRouter. Ключ только в server/.env, не в телефоне и не в git."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import threading
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(ROOT)
DATA = os.path.join(ROOT, "data", "state.json")
ENV = os.path.join(ROOT, ".env")
LOCK = threading.Lock()
TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".ico": "image/x-icon",
}


def load_env():
    if not os.path.exists(ENV):
        return
    with open(ENV, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"'))


def read_state():
    if not os.path.exists(DATA):
        return {"rev": 0, "shared": {}}
    with open(DATA, encoding="utf-8") as handle:
        return json.load(handle)


def write_state(payload):
    os.makedirs(os.path.dirname(DATA), exist_ok=True)
    with open(DATA, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(fmt % args)

    def send_json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS")
        self.end_headers()

    def serve_file(self):
        raw = self.path.split("?", 1)[0]
        rel = raw.lstrip("/") or "index.html"
        if rel.endswith("/"):
            rel += "index.html"
        parts = rel.replace("\\", "/").split("/")
        if any(part in ("", ".", "..") for part in parts) or parts[0] == "server":
            self.send_json(404, {"error": "нет такого адреса"})
            return
        full = os.path.normpath(os.path.join(WEB, *parts))
        web = os.path.normpath(WEB)
        if full != web and not full.startswith(web + os.sep):
            self.send_json(404, {"error": "нет такого адреса"})
            return
        if not os.path.isfile(full):
            self.send_json(404, {"error": "нет такого адреса"})
            return
        with open(full, "rb") as handle:
            body = handle.read()
        self.send_response(200)
        self.send_header("Content-Type", TYPES.get(os.path.splitext(full)[1].lower(), "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self):
        if self.path == "/api/health":
            self.send_json(200, {"ok": True, "model": bool(os.environ.get("OPENROUTER_API_KEY"))})
            return
        if self.path.split("?", 1)[0] == "/api/state":
            with LOCK:
                self.send_json(200, read_state())
            return
        self.serve_file()

    def do_PUT(self):
        if self.path != "/api/state":
            self.send_json(404, {"error": "нет такого адреса"})
            return
        incoming = self.read_body()
        with LOCK:
            current = read_state()
            if int(incoming.get("rev") or 0) != int(current.get("rev") or 0):
                self.send_json(409, current)
                return
            saved = {"rev": int(current.get("rev") or 0) + 1, "shared": incoming.get("shared") or {}}
            write_state(saved)
        self.send_json(200, {"rev": saved["rev"]})

    def do_POST(self):
        if self.path != "/api/chat":
            self.send_json(404, {"error": "нет такого адреса"})
            return
        key = os.environ.get("OPENROUTER_API_KEY", "")
        if not key:
            self.send_json(500, {"error": {"message": "На сервере нет ключа OpenRouter"}})
            return
        payload = self.read_body()
        payload["model"] = payload.get("model") or "deepseek/deepseek-chat"
        request = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/NexusMinsk/merch",
                "X-Title": "merch",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.loads(response.read().decode("utf-8"))
            self.send_json(200, data)
        except Exception as error:
            detail = getattr(error, "read", lambda: b"")()
            message = detail.decode("utf-8", "ignore") if detail else str(error)
            self.send_json(502, {"error": {"message": message[:500] or "OpenRouter не ответил"}})


if __name__ == "__main__":
    load_env()
    port = int(os.environ.get("MERCH_PORT") or 8787)
    print(f"merch server http://127.0.0.1:{port}")
    print("На телефонах в той же Wi-Fi откройте http://<адрес этого компьютера>:" + str(port))
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
