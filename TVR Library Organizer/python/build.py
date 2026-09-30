#!/usr/bin/env python3
"""
PyInstaller Driver for TVR Downloader Engine
Compiles python/engine.py into a standalone executable in python-dist/
"""

import os
import sys
import shutil
import subprocess

def build_engine():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    engine_script = os.path.join(base_dir, "python", "engine.py")
    dist_dir = os.path.join(base_dir, "python-dist")
    build_dir = os.path.join(base_dir, "build", "pyinstaller_temp")

    print(f"==> Building TVR Downloader Python Engine...")
    print(f"    Script: {engine_script}")
    print(f"    Output: {dist_dir}")

    os.makedirs(dist_dir, exist_ok=True)
    os.makedirs(build_dir, exist_ok=True)

    pyinstaller_cmd = [
        sys.executable,
        "-m", "PyInstaller",
        "--name=engine",
        "--onefile",
        "--clean",
        f"--distpath={dist_dir}",
        f"--workpath={build_dir}",
        "--hidden-import=yt_dlp",
        "--hidden-import=yt_dlp.extractor",
        "--hidden-import=yt_dlp.postprocessor",
        "--hidden-import=certifi",
        "--copy-metadata=yt-dlp",
        "--copy-metadata=certifi",
        "--collect-all=yt_dlp",
        "--noconfirm",
        engine_script
    ]

    print("==> Executing PyInstaller...")
    res = subprocess.run(pyinstaller_cmd)
    if res.returncode != 0:
        print(f"ERROR: PyInstaller failed with code {res.returncode}")
        sys.exit(res.returncode)

    # Clean up temp build folder
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir, ignore_errors=True)

    spec_file = os.path.join(base_dir, "engine.spec")
    if os.path.isfile(spec_file):
        os.remove(spec_file)

    exe_name = "engine.exe" if sys.platform.startswith("win") else "engine"
    final_bin = os.path.join(dist_dir, exe_name)
    if os.path.isfile(final_bin):
        print(f"SUCCESS: Frozen engine binary created at {final_bin}")
    else:
        print(f"WARNING: Binary expected at {final_bin} not found")

if __name__ == "__main__":
    build_engine()
