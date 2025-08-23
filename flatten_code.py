#!/usr/bin/env python3
"""
flatten_code.py — Walk a project directory and concatenate selected source files
into a single text document with clear file headers/footers.

NEW: Respects .gitignore WITHOUT extra dependencies by using the local `git` CLI.
- If the directory is a Git repo and `git` is available, ignored files are skipped
  using: git ls-files --ignored --exclude-standard --others -z
- Tracked files are always included (even if patterns match .gitignore).
- If not a Git repo (or git missing), falls back to exclude list only.

Usage examples:
  python flatten_code.py --root . --output project-code.txt
  python flatten_code.py --root /path/to/repo --output all.txt --ext ".js,.ts,.tsx,.java,.kt,.py" --exclude ".git,node_modules,dist,build" --max-bytes 1048576
"""
import argparse, os, sys, subprocess, shutil
from pathlib import Path

DEFAULT_EXTS = [
    ".js",".jsx",".ts",".tsx",".mjs",".cjs",
    ".json",".jsonc",
    ".py",
    ".java",".kt",".kts",".gradle",".groovy",
    ".rb",".go",".php",".swift",".m",".mm",".c",".h",".cpp",".hpp",
    ".rs",".dart",".lua",
    ".xml",".html",".htm",".css",".scss",".less",
    ".yml",".yaml",".ini",".cfg",".conf",".properties",".env",
    ".md",".mdx",".txt",
    ".sh",".bash",".zsh",".ps1",".bat",
    ".sql",".proto",
    ".gitignore",".gitattributes",".editorconfig"
]

DEFAULT_EXCLUDES = [
    ".git","node_modules","dist","build",".next",".expo",".idea",".vscode",
    ".venv","venv","Pods","ios/build","android/build","coverage",".gradle"
]

def should_skip_dir(dirpath, excludes_set):
    parts = Path(dirpath).parts
    for token in excludes_set:
        token_parts = Path(token).parts
        if len(token_parts) > 1:
            if tuple(token_parts) == tuple(parts[-len(token_parts):]):
                return True
        else:
            if token in parts:
                return True
    return False

def get_git_ignored(root: Path):
    """
    Return a set of POSIX-style relative paths that are ignored by git.
    Uses: git ls-files --ignored --exclude-standard --others -z
    Only returns files that are ignored AND untracked; tracked files won't appear here.
    """
    if not (root / ".git").exists():
        return set()
    if shutil.which("git") is None:
        return set()
    try:
        out = subprocess.check_output(
            ["git", "ls-files", "--ignored", "--exclude-standard", "--others", "-z"],
            cwd=str(root)
        )
        items = out.decode("utf-8", errors="replace").split("\x00")
        rels = [i for i in items if i]
        # Normalize to POSIX-style
        return set(Path(r).as_posix() for r in rels)
    except Exception:
        return set()

def iter_files(root, exts_set, excludes_set, max_bytes, ignored_set):
    root = Path(root).resolve()
    for dirpath, dirnames, filenames in os.walk(root):
        # prune disallowed dirs
        pruned = []
        for d in list(dirnames):
            full = Path(dirpath) / d
            if should_skip_dir(full, excludes_set):
                pruned.append(d)
        for d in pruned:
            dirnames.remove(d)

        for name in filenames:
            p = Path(dirpath) / name
            rel_posix = p.resolve().relative_to(root).as_posix()

            # Skip git-ignored files if we have that info
            if rel_posix in ignored_set:
                continue

            if exts_set and p.suffix.lower() not in exts_set and name not in exts_set:
                continue
            try:
                if max_bytes and p.stat().st_size > max_bytes:
                    continue
            except OSError:
                continue
            yield p

def main():
    ap = argparse.ArgumentParser(description="Concatenate source files into a single doc with headers, honoring .gitignore if possible (no extra deps).")
    ap.add_argument("--root", default=".", help="Root directory to scan (default: .)")
    ap.add_argument("--output", default="project-code.txt", help="Output file path")
    ap.add_argument("--ext", default=",".join(DEFAULT_EXTS),
                    help="Comma-separated list of file extensions or exact filenames to include")
    ap.add_argument("--exclude", default=",".join(DEFAULT_EXCLUDES),
                    help="Comma-separated list of directories (or suffix paths) to exclude")
    ap.add_argument("--max-bytes", type=int, default=2*1024*1024,
                    help="Skip files larger than this (default 2 MiB)")
    args = ap.parse_args()

    exts = [e.strip() for e in args.ext.split(",") if e.strip()]
    norm_exts = set()
    for e in exts:
        if e.startswith(".") or "." in e:
            norm_exts.add(e.lower())
        else:
            norm_exts.add("." + e.lower())

    excludes = set([e.strip() for e in args.exclude.split(",") if e.strip()])

    root = Path(args.root).resolve()
    ignored_set = get_git_ignored(root)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    total_files = 0
    with out_path.open("w", encoding="utf-8", errors="replace") as out:
        out.write("# Consolidated source export\n")
        out.write(f"# Root: {root}\n")
        out.write(f"# Included: {sorted(norm_exts)}\n")
        out.write(f"# Excluded dirs: {sorted(excludes)}\n")
        out.write(f"# Git ignored entries skipped: {len(ignored_set)} (if repo)\n")
        out.write("# ---\n\n")

        for p in iter_files(root, norm_exts, excludes, args.max_bytes, ignored_set):
            rel = p.resolve().relative_to(root)
            try:
                content = p.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue
            out.write(f"\n\n===== BEGIN FILE: {rel} =====\n")
            out.write(content)
            if not content.endswith("\n"):
                out.write("\n")
            out.write(f"===== END FILE: {rel} =====\n")
            total_files += 1

    print(f"Done. Wrote {total_files} files into {out_path}")

if __name__ == "__main__":
    sys.exit(main())
