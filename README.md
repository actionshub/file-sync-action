# Repo Sync by Topics

Sync a subfolder from a source repository to many target repositories discovered dynamically by GitHub topics.

## Features (current)

- Secure clone of source repo with token sanitized post-clone (`.git/config`
  and `origin` remote are scrubbed).
- Non-interactive git in CI (`GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=/bin/true`).
- Robust temp directory cleanup on failures.
- Integration-tested discovery and cloning logic using a real token.
- Local folder sync logic that is idempotent (only copies changed files).

> Status: The action is under active development. Inputs and examples below
> reflect current wiring in `action.yml`. Remote PR creation and additional
> options are being implemented iteratively (TDD).

## Inputs

- **token** (required)
  - GitHub token with permission to read the source repo and push branches
    and open PRs in targets.
  - Prefer a GitHub App installation token or a PAT with appropriate scopes.
- **source_repo** (required)
  - `<owner>/<repo>` of the source repository.
- **source_path** (required)
  - Subfolder in the source repository to sync, e.g. `standardfiles/cookbook`.
- **target_org** (required)
  - Organization to search for target repositories.
- **search_topics** (required)
  - Comma-separated list of topics to filter target repositories,
    e.g. `chef-cookbook`.
- **branch_name** (optional)
  - Branch name to create/update on targets (default may be computed if omitted).
- **commit_prefix** (optional)
  - Prefix for commit messages (e.g. `chore:`).
- **pr_title** (optional)
  - Title for created/updated pull requests.
- **pr_body** (optional)
  - Body for created/updated pull requests.
- **labels** (optional)
  - Newline-separated list of labels to add to PRs.
- **pr_tags** (optional)
  - Additional PR labels to apply (alias for `labels`).
  - Accepts a JSON array string or a newline-separated list.
  - See examples below.
- **assignees** (optional)
  - Newline-separated GitHub usernames to assign to PRs.
- **reviewers** (optional)
  - Newline-separated GitHub usernames to request review from.
- **team_reviewers** (optional)
  - Newline-separated GitHub team slugs to request review from.
- **dry_run** (optional; default `false`)
  - If `true`, do not push branches or open PRs.

### Additional inputs

For compatibility with `repo-file-sync-action`, the following inputs are also
accepted (not all are wired yet): `GH_PAT`, `GH_INSTALLATION_TOKEN`,
`CONFIG_PATH`, `IS_FINE_GRAINED`, `PR_LABELS`, `PR_BODY`, `ASSIGNEES`,
`REVIEWERS`, `TEAM_REVIEWERS`, `COMMIT_PREFIX`, `COMMIT_BODY`,
`COMMIT_EACH_FILE`, `GIT_EMAIL`, `GIT_USERNAME`, `TMP_DIR`, `DRY_RUN`
(uppercase variant), `SKIP_CLEANUP`, `OVERWRITE_EXISTING_PR`,
`ORIGINAL_MESSAGE`, `COMMIT_AS_PR_TITLE`, `SKIP_PR`, `BRANCH_PREFIX`, `FORK`.

## Outputs

- **pull_request_urls**
  - Newline-separated list of created/updated PR URLs (when applicable).

## Minimal workflow example

```yaml
name: Sync standard files

on:
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Repo sync by topics
        uses: actionshub/repo-sync-action@main
        with:
          token: ${{ secrets.GH_PAT }}
          source_repo: sous-chefs/repo-management
          source_path: standardfiles/cookbook
          target_org: sous-chefs
          search_topics: chef-cookbook
          pr_tags: '["Release: Skip", "Release: Minor"]'
          dry_run: 'true' # set to 'false' to actually push branches and open PRs
```

You can also provide `pr_tags` as a newline-separated string:

```yaml
pr_tags: |
  Release: Skip
  Release: Minor
```

## Tag-triggered example

```yaml
name: Sync on release tag

on:
  push:
    tags:
      - 'v*'

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Repo sync by topics
        uses: actionshub/repo-sync-action@main
        with:
          token: ${{ secrets.GH_PAT }}
          source_repo: sous-chefs/repo-management
          source_path: standardfiles/cookbook
          target_org: sous-chefs
          search_topics: chef-cookbook
```

## Security notes

- The action clones with a tokenized URL only for the initial fetch, then
  immediately resets the `origin` remote to a token-free URL, preventing
  leakage to logs or `.git/config`.
- Git prompts are disabled for CI stability.
- Temporary directories are cleaned even on error paths.

## Development

- Node version: use `.nvmrc` or `.tool-versions` (Node `22.17.0`).
- Install: `npm ci`
- Run tests once: `npm test`
- Watch tests on change: `npm run watch`
- Markdown lint: `npm run lint:md`

Tests rely on a real GitHub token. Provide via one of:

- `GITHUB_TOKEN`
- `GH_TOKEN`
- `GH_PAT`

If absent, tests attempt `gh auth token` via the GitHub CLI.

## Sync configuration file format

When using `CONFIG_PATH`, provide a YAML mapping of repositories to arrays of
file specs. Examples:

### Example 1 — strings only (same source and destination)

```yaml
owner/repository:
  - .github/workflows/test.yml
  - .github/workflows/lint.yml
```

### Example 2 — custom destinations

```yaml
owner/repository:
  - source: workflows/stale.yml
    dest: .github/workflows/stale.yml
  - source: templates/README.md
    dest: README.md
```

### Example 3 — multiple repositories, mixed specs

```yaml
owner/repo-a:
  - .editorconfig
  - .github/dependabot.yml

owner/repo-b:
  - source: ci/release.yml
    dest: .github/workflows/release.yml
  - source: ci/test.yml
    dest: .github/workflows/test.yml
```

Each item can be either a string (same source and destination path) or an
object with `source` and `dest` keys for custom destination paths.

### Full examples in this repo

- Example 1
  - Workflow: [`.github/workflows/test-1.yml`](.github/workflows/test-1.yml)
  - Config: [`.github/sync-test-1.yml`](.github/sync-test-1.yml)
  - Docs: [`.github/EXAMPLE-test-1.md`](.github/EXAMPLE-test-1.md)

- Example 2
  - Workflow: [`.github/workflows/test-2.yml`](.github/workflows/test-2.yml)
  - Config: [`.github/sync-test-2.yml`](.github/sync-test-2.yml)
  - Docs: [`.github/example-test-2.md`](.github/example-test-2.md)

## Contributing

- We follow strict TDD (Red-Green-Refactor) and small, focused commits using
  Conventional Commits.
- Prefer integration tests without mocks for behavior.
- Please ensure all tests and linters pass locally and in CI before opening a PR.
