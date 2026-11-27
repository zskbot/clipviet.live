#!/usr/bin/env python3
"""Loopback-only ClipViet bridge for an already-installed Jasna CLI.

This wrapper never exposes Jasna as a public server. It accepts authorized local
video files from the ClipViet browser UI and runs the user's local GPU executable.
"""
from __future__ import annotations

import hmac
import json
import mimetypes
import os
import re
import secrets
import shutil
import subprocess
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

HOST = "127.0.0.1"
PORT = int(os.environ.get("CLIPVIET_JASNA_PORT", "8765"))
JASNA_BIN = os.environ.get("JASNA_BIN", "jasna")
WORKDIR = Path(os.environ.get("JASNA_WORKDIR", str(Path.home() / "ClipViet-Jasna"))).expanduser().resolve()
MAX_BYTES = int(os.environ.get("CLIPVIET_JASNA_MAX_BYTES", str(8 * 1024 * 1024 * 1024)))
TOKEN = os.environ.get("CLIPVIET_JASNA_TOKEN") or secrets.token_urlsafe(32)
EXTENSIONS = {".mp4", ".mkv", ".mov", ".webm", ".avi", ".m4v"}
JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()
GPU_SLOT = threading.Semaphore(1)
PREVIEW_ORIGINS = (
    re.compile(r"^https://[a-f0-9]+\.clipviet-live-preview\.pages\.dev$", re.I),
    re.compile(r"^https://[a-f0-9]+\.clipviet-live-independent-preview\.pages\.dev$", re.I),
)
EXACT_ORIGINS = {
    value.strip() for value in os.environ.get(
        "CLIPVIET_ALLOWED_ORIGINS",
        "https://clipviet.live,https://www.clipviet.live"
    ).split(",") if value.strip()
}


def allowed_origin(origin: str) -> bool:
    if not origin:
        return True
    return origin in EXACT_ORIGINS or any(pattern.fullmatch(origin) for pattern in PREVIEW_ORIGINS)


def json_bytes(payload: dict) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def clean_filename(value: str) -> str:
    name = Path(unquote(value or "video.mp4")).name
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    if not name:
        name = "video.mp4"
    suffix = Path(name).suffix.lower()
    if suffix not in EXTENSIONS:
        raise ValueError("Unsupported video extension.")
    return name[:120]


class Handler(BaseHTTPRequestHandler):
    server_version = "ClipVietJasnaBridge/1.0"

    def log_message(self, _format: str, *_args) -> None:
        return

    def _origin(self) -> str:
        return self.headers.get("Origin", "")

    def _cors(self) -> None:
        origin = self._origin()
        if origin and allowed_origin(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def _send(self, status: int, payload: dict) -> None:
        body = json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _host_is_local(self) -> bool:
        host = self.headers.get("Host", "").split(":", 1)[0].strip("[]").lower()
        return host in {"127.0.0.1", "localhost"}

    def _authorized(self) -> bool:
        supplied = self.headers.get("X-ClipViet-Token", "")
        if not supplied:
            auth = self.headers.get("Authorization", "")
            supplied = auth[7:] if auth.lower().startswith("bearer ") else ""
        return bool(supplied) and hmac.compare_digest(supplied, TOKEN)

    def _preflight(self) -> None:
        origin = self._origin()
        if not self._host_is_local() or not allowed_origin(origin):
            self._send(403, {"error": "Origin or host is not allowed."})
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-ClipViet-Token, X-File-Name, X-ClipViet-Rights-Attested, X-ClipViet-Consent-Attested")
        self.send_header("Access-Control-Max-Age", "600")
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_OPTIONS(self) -> None:
        self._preflight()

    def do_GET(self) -> None:
        if not self._host_is_local() or not allowed_origin(self._origin()):
            self._send(403, {"error": "Origin or host is not allowed."})
            return
        path = urlsplit(self.path).path
        if path == "/health":
            self._send(200, {
                "ok": True,
                "service": "clipviet-jasna-local-bridge",
                "jasnaAvailable": bool(shutil.which(JASNA_BIN) or Path(JASNA_BIN).is_file()),
                "gpuJobs": "single-job-queue",
                "storage": "local-only",
            })
            return
        if not self._authorized():
            self._send(401, {"error": "A valid local bridge token is required."})
            return
        match = re.fullmatch(r"/jobs/([a-f0-9]{32})(/download)?", path)
        if not match:
            self._send(404, {"error": "Route not found."})
            return
        job_id, download = match.groups()
        with JOBS_LOCK:
            job = JOBS.get(job_id)
        if not job:
            self._send(404, {"error": "Job not found."})
            return
        if not download:
            self._send(200, {
                "id": job_id,
                "status": job["status"],
                "outputName": job["output"].name,
                "error": job.get("public_error", ""),
            })
            return
        if job["status"] != "completed" or not job["output"].is_file():
            self._send(409, {"error": "Output is not ready."})
            return
        self._send_file(job["output"])

    def _send_file(self, path: Path) -> None:
        size = path.stat().st_size
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(size))
        self.send_header("Content-Disposition", 'attachment; filename="' + path.name.replace('"', "") + '"')
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self._cors()
        self.end_headers()
        with path.open("rb") as source:
            shutil.copyfileobj(source, self.wfile, length=1024 * 1024)

    def do_POST(self) -> None:
        if not self._host_is_local() or not allowed_origin(self._origin()):
            self._send(403, {"error": "Origin or host is not allowed."})
            return
        if urlsplit(self.path).path != "/jobs":
            self._send(404, {"error": "Route not found."})
            return
        if not self._authorized():
            self._send(401, {"error": "A valid local bridge token is required."})
            return
        if self.headers.get("X-ClipViet-Rights-Attested") != "true" or self.headers.get("X-ClipViet-Consent-Attested") != "true":
            self._send(403, {"error": "Rights and adult-performer consent attestations are required."})
            return
        try:
            filename = clean_filename(self.headers.get("X-File-Name", "video.mp4"))
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1:
                raise ValueError("The uploaded file is empty.")
            if length > MAX_BYTES:
                raise ValueError("The video exceeds the local bridge size limit.")
        except (ValueError, TypeError) as error:
            self._send(400, {"error": str(error)})
            return
        candidate = Path(JASNA_BIN).expanduser()
        executable = shutil.which(JASNA_BIN) or (str(candidate.resolve()) if candidate.is_file() else "")
        if not executable:
            self._send(503, {"error": "Jasna CLI was not found. Set JASNA_BIN to the installed executable."})
            return
        if not str(WORKDIR).isascii():
            self._send(400, {"error": "JASNA_WORKDIR must use an ASCII-only path as required by Jasna."})
            return
        WORKDIR.mkdir(parents=True, exist_ok=True)
        job_id = uuid.uuid4().hex
        job_dir = WORKDIR / job_id
        job_dir.mkdir(mode=0o700)
        input_path = job_dir / filename
        output_path = job_dir / (Path(filename).stem + "-restored.mkv")
        log_path = job_dir / "jasna.log"
        remaining = length
        try:
            with input_path.open("xb") as target:
                while remaining:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        raise ValueError("Upload ended before Content-Length bytes were received.")
                    target.write(chunk)
                    remaining -= len(chunk)
        except Exception as error:
            shutil.rmtree(job_dir, ignore_errors=True)
            self._send(400, {"error": str(error)})
            return
        with JOBS_LOCK:
            JOBS[job_id] = {"status": "queued", "input": input_path, "output": output_path, "log": log_path, "dir": job_dir}
        threading.Thread(target=self._run_job, args=(job_id, executable), daemon=True).start()
        self._send(202, {"id": job_id, "status": "queued", "outputName": output_path.name})

    @staticmethod
    def _run_job(job_id: str, executable: str) -> None:
        try:
            with GPU_SLOT:
                with JOBS_LOCK:
                    job = JOBS[job_id]
                    job["status"] = "running"
                with job["log"].open("wb") as log:
                    result = subprocess.run(
                    [executable, "--input", str(job["input"]), "--output", str(job["output"])],
                    cwd=str(job["dir"]),
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    timeout=24 * 60 * 60,
                    check=False,
                    shell=False,
                )
            with JOBS_LOCK:
                if result.returncode == 0 and job["output"].is_file() and job["output"].stat().st_size > 0:
                    job["status"] = "completed"
                else:
                    job["status"] = "failed"
                    job["public_error"] = "Jasna did not produce an output file. Inspect the local Jasna log."
        except subprocess.TimeoutExpired:
            with JOBS_LOCK:
                job["status"] = "failed"
                job["public_error"] = "The local processing job exceeded the 24-hour limit."
        except Exception:
            with JOBS_LOCK:
                job["status"] = "failed"
                job["public_error"] = "The local processing job failed. Inspect the local Jasna log."


def main() -> None:
    if not str(WORKDIR).isascii():
        raise SystemExit("JASNA_WORKDIR must use an ASCII-only path.")
    WORKDIR.mkdir(parents=True, exist_ok=True)
    if not TOKEN or len(TOKEN) < 32:
        raise SystemExit("CLIPVIET_JASNA_TOKEN must contain at least 32 characters.")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("ClipViet Jasna Bridge listening only on http://127.0.0.1:" + str(PORT))
    print("Local token (paste into the ClipViet Jasna page; do not share): " + TOKEN)
    print("Work directory: " + str(WORKDIR))
    print("Allowed site origins: " + ", ".join(sorted(EXACT_ORIGINS)))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping local bridge…")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
