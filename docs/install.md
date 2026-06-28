# Install

Install the latest prebuilt binary for your platform and add shell integration:

```bash
curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | sh
```

Install a specific release:

```bash
curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | sh -s -- v0.1.2
```

Linux release archives include the `ai` launcher plus hidden runtime payload
files used to make the prebuilt binary work on hosts that do not provide every
Node/GCC runtime library by default. Prefer `install.sh` or copy the entire
extracted archive contents together; copying only the hidden `.ai-real` binary
can fail with missing libraries such as `libatomic.so.1`.

On NixOS, the Linux launcher falls back to Nixpkgs' dynamic linker when the
usual `/lib*/ld-linux*` path is absent. If you manage `ai` declaratively, prefer
a Nix/Home Manager package so upgrades are pinned and reproducible.

Customize the shell wrapper name:

```bash
curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | AI_SHELL_NAME=a sh
```

Skip shell integration:

```bash
curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | AI_INSTALL_SHELL=0 sh
```

Developer install:

```bash
npm install
npm link
```

Upgrade the installed binary to the latest release:

```bash
command ai upgrade
```

Upgrade to a specific release:

```bash
command ai upgrade v0.1.2
```

If shell integration changes after an upgrade, refresh it:

```bash
command ai upgrade
command ai shell install zsh --name ai   # or bash/fish
```
