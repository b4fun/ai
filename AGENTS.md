# AGENTS.md

Guidance for future work in this repository.

## General
- Prefer small, targeted changes.
- Do not commit, tag, push, or publish unless explicitly asked.
- Avoid assuming extra dependencies are available unless verified in the repo or by the user.
- Prefer shell-native tooling and existing project scripts over introducing new tooling.

## Versioning
- `package.json` is the source of truth for the project version.
- Do not maintain a separate checked-in version file.
- The standalone SEA build uses `B4FUN_AI_VERSION` when set and otherwise injects the package version.
- When bumping a release version, update:
  - `package.json`
  - `package-lock.json`
  - release/install documentation that references a version

## Build / release flow
1. Bump the version in `package.json`.
2. Run tests:
   - `npm test`
   - `npm run check`
3. Build the SEA artifact:
   - `npm run build:sea`
4. Verify the built binary reports the expected version:
   - `dist/sea/ai --version`
5. Verify install flow from the release URL if needed:
   - `curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | AI_INSTALL_DIR=/tmp/... AI_INSTALL_SHELL=0 sh -s -- vX.Y.Z`
6. Create the git commit and tag only when requested.
7. Publish the GitHub release only after the tag exists and the workflow assets are attached.

## Release workflow guardrails
- The release workflow should smoke test the SEA binary.
- The release smoke test should confirm `dist/sea/ai --version` matches the release tag without its leading `v`.
- If the release artifact fails, check whether the issue is:
  - version mismatch
  - runtime access to repo files that do not exist in SEA
  - installer download path or GitHub release asset handling

## Installer notes
- Prefer stable GitHub release URL patterns over parsing JSON when possible.
- For tagged releases, use the release download URL pattern.
- For latest releases, use the `latest/download` URL pattern.
- Keep checksum verification in place.

## Documentation
- Update README and install docs when user-facing release behavior changes.
- If the release flow changes, reflect that here.
