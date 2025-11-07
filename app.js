#!/usr/bin/env python3
"""
Zero-dependency static server + /run endpoint.

Use:
  python server.py --port 8080

Security:
  This executes arbitrary shell commands received from the client. Only run in a trusted environment.
"""
import http.server
import socketserver
import argparse
import json
import urllib
import os
import subprocess
import sys
from http import HTTPStatus

# Small helper to map extensions -> mime types
MIME_MAP = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
}

class Handler(http.server.SimpleHTTPRequestHandler):
    # serve files relative to current working directory (index.html at root)
    def end_headers(self):
        # allow cross origin (useful in Codespaces preview)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def guess_type(self, path):
        _, ext = os.path.splitext(path)
        return MIME_MAP.get(ext.lower(), super().guess_type(path))

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_POST(self):
        # Only handle /run specially; otherwise fall back to 404
        if self.path != "/run":
            self.send_error(HTTPStatus.NOT_FOUND, "Only /run is supported for POST")
            return

        content_length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(content_length) if content_length > 0 else b""
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            data = {}
        cmd = data.get("cmd", "")
        if not isinstance(cmd, str) or not cmd.strip():
            self.send_response(HTTPStatus.BAD_REQUEST)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "no command provided"}).encode("utf-8"))
            return

        # Run the command (shell=True to allow pipes/redirection)
        try:
            proc = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
            res = {
                "stdout": proc.stdout or "",
                "stderr": proc.stderr or "",
                "returncode": proc.returncode
            }
        except subprocess.TimeoutExpired:
            res = {"stdout": "", "stderr": "Command timed out", "returncode": 124}
        except Exception as e:
            res = {"stdout": "", "stderr": f"Execution error: {e}", "returncode": 1}

        body = json.dumps(res).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

def run_server(port):
    # Serve from current directory (index.html and static/ must be here)
    handler = Handler
    # Ensure the server reuses the address so restarts are smoother
    class TCPServer(socketserver.ThreadingTCPServer):
        allow_reuse_address = True

    with TCPServer(("", port), handler) as httpd:
        print(f"Serving on 0.0.0.0:{port} (serving files from {os.getcwd()})")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Shutting down server")

def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8080)), help="Port to listen on")
    args = parser.parse_args(argv)
    run_server(args.port)

if __name__ == "__main__":
    main()
