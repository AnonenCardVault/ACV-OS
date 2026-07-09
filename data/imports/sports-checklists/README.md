# Sports Checklist Catalog Imports

This folder keeps the source-controlled inputs for the ACV Sports Catalog Builder.

Tracked files:
- `targets/sports-checklist-targets.json`
- `discovered-urls/checklist-urls.json`

Generated local artifacts are intentionally ignored and should not be committed:
- `raw/`
- `normalized/`
- `logs/`
- `discovered-urls/checklist-url-candidates.json`

Run discovery/import scripts locally to regenerate these artifacts when needed. The large raw HTML, normalized JSON, and diagnostic logs are working outputs, not source data.
