# Example 1 — strings only (same source and destination)

This example shows how to run the action with a config file whose items are simple strings.
Each string copies a file to the same relative destination path in the target repo.

- Workflow: `.github/workflows/test-1.yml`
- Config file (overridden via `CONFIG_PATH`): `.github/sync-test-1.yml`

## Workflow

```yaml
name: Repo Sync Example 1
on:
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Repo sync (example 1 — config override)
        uses: actionshub/repo-sync-action@main
        with:
          token: ${{ secrets.GH_PAT }}
          source_repo: sous-chefs/repo-management
          source_path: standardfiles/cookbook
          target_org: sous-chefs
          search_topics: chef-cookbook
          CONFIG_PATH: .github/sync-test-1.yml
          dry_run: 'true'
```

## Config

```yaml
owner/repository:
  - .github/workflows/test.yml
  - .github/workflows/lint.yml
```

## Notes

- Use the `CONFIG_PATH` input to point the action at a non-default config filename.
- Each string entry means "copy this file from the source path to the same path in the target repo".
