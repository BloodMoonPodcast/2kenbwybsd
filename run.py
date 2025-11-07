#!/usr/bin/env python3
"""
Small convenience entrypoint:

  python run.py --port 8080

This will run server.py (no extra installs required).
"""
import argparse
import os
import sys
from server import main as server_main

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8080)))
    args = parser.parse_args()
    # forward through to server.main
    server_main(["--port", str(args.port)])

if __name__ == "__main__":
    main()
