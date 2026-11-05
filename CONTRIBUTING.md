# Contributing

```sh
nix develop          # or any Node >= 22 with pnpm
pnpm install
pnpm typecheck
pnpm test            # bundles, then runs the smoke test
```

`nix develop` installs a pre-commit hook (`.githooks/`) that refreshes `nix/pnpm-deps.hash`
whenever `pnpm-lock.yaml` is staged.
Without the dev shell, run `scripts/update-pnpm-hash.sh` after changing dependencies.
CI runs `nix build`, which fails when that hash is stale.
On same-repo PRs that change the lockfile, a workflow commits the new hash and reruns CI.

Never commit a real `cbtoken`, recipe data or personal paths.

## Releases

Releases are automated with release-please.
Commit messages (or squash-merged PR titles) follow [Conventional Commits](https://www.conventionalcommits.org):
`fix:` makes a patch release, `feat:` a minor one, and `feat!:` or a `BREAKING CHANGE:` footer a major one.
`chore:`, `docs:` and `ci:` do not trigger a release.

A bot keeps one release PR open with the version bump and changelog.
Merging it tags the release, attaches the bundle to the GitHub Release and publishes to npm.
