# Contributing to Porthole

Thanks for your interest. The project is at a very early stage, so the most useful contributions right now are issues: bug reports, Frigate version quirks, and feature discussion.

## Ground rules

- Open an issue before starting any non-trivial PR, so we can agree on the approach first.
- `main` is protected; all changes land via pull request.
- Keep PRs focused: one change per PR.
- Run `make lint` and `make test` before pushing (once the app scaffold exists).

## Commit style

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, ...). Subject line 50 characters or fewer.

## Releases

Releases are cut with `make release V=X.Y.Z` (tags `vX.Y.Z` on `main`). The tag triggers a workflow that creates the GitHub release with generated notes, runs an EAS cloud build of the Android APK, and attaches the APK to the release page. Requires the `EXPO_TOKEN` repository secret.

## Licence

By contributing you agree that your contributions are licensed under MPL-2.0.
