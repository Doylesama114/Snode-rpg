#!/usr/bin/env python3
"""Run all apply_*_sync.py scripts."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
scripts = sorted(ROOT.glob("apply_*_sync.py"))
if __name__ == "__main__":
    failed = []
    for script in scripts:
        if script.name == "run_all_class_syncs.py":
            continue
        print(f"\n=== {script.name} ===", flush=True)
        rc = subprocess.call([sys.executable, str(script)], cwd=str(ROOT))
        if rc != 0:
            failed.append(script.name)
    if failed:
        print("\nFAILED:", ", ".join(failed))
        sys.exit(1)
    print("\nAll sync scripts OK")
