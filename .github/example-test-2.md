# Example 2 — custom destinations

This example shows how to run the action with a config file that maps sources to custom destination paths in the target repo.

- Workflow: `.github/workflows/test-2.yml`
- Config file (overridden via `CONFIG_PATH`): `.github/sync-test-2.yml`

## Workflow

```yaml
name: Repo Sync Example 2
on:
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Repo sync (example 2 — config override)
        uses: actionshub/repo-sync-action@main
        with:
          token: ${{ secrets.GH_PAT }}
          source_repo: sous-chefs/repo-management
          source_path: standardfiles/cookbook
          target_org: sous-chefs
          search_topics: chef-cookbook
          CONFIG_PATH: .github/sync-test-2.yml
          dry_run: 'true'
```

## Config

```yaml
owner/repository:
  - source: workflows/stale.yml
    dest: .github/workflows/stale.yml
  - source: templates/README.md
    dest: README.md
```

## Notes

- `source` is relative to the `source_path` in the source repo checkout.
- `dest` is the target path relative to the root of each target repository.
