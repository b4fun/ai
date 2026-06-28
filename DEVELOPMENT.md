# Development

## Build a standalone binary

There is a standalone executable build path based on Node SEA:

```bash
npm run build:sea
```

This requires Node 25 or newer. It bundles the CLI as ESM, generates a SEA blob, copies the current Node executable, injects the blob, and re-signs the executable when needed on macOS. The output lands in:

```text
dist/sea/ai
```

Release builds are produced by `.github/workflows/release.yml` and uploaded as compressed prebuilt binaries with `.sha256` digest files.
