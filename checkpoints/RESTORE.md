# C03 baseline - preserved 13 October 2026

Commit: `1075d02` (pre-event work).
Absolute backup directory: `D:\RECLAIM\checkpoints`.

- `reclaim-c03-1075d02-source.zip`: tracked source, original PDFs, plans, tests,
  sample data, dependency manifests and screenshot.
- `reclaim-c03-1075d02-build.zip`: compiled frontend for the same checkpoint.
- `C03-MANIFEST.json`: archive sizes and SHA-256 checksums.

Both archives were opened and checked with ZipFile.testzip(); neither reported errors.
This is a second copy on the same drive, not protection against drive failure.
No database records, secrets, .venv or node_modules are included.

## Restore without overwriting ongoing work
1. Create a new empty folder, for example `D:\RECLAIM-restored-C03`.
2. Extract the source archive there. Optionally extract the build archive into the
   same folder; it restores `frontend/dist`.
3. Read README.md. Install dependencies with scripts/setup.ps1 (requires internet).
4. Run scripts/verify.ps1, then scripts/run.ps1. Use a different port if the current
   prototype is still running.
5. Start with a fresh fictional case; runtime case records were deliberately excluded.

The ZIP is not a fully offline, self-contained executable. Existing .venv and
node_modules remain in the original working folder. Do not delete the working folder.
If needed, verify an archive with `Get-FileHash -Algorithm SHA256 <archive-path>` and
compare against the manifest. Do not modify the baseline ZIPs as development continues.
