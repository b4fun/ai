# Install

Install the latest prebuilt binary for your platform and add shell integration:

```bash
curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | sh
```

Install a specific release:

```bash
curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | sh -s -- v0.1.0-alpha.9
```

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
command ai upgrade v0.1.0-alpha.9
```

If shell integration changes after an upgrade, refresh it:

```bash
command ai upgrade
command ai shell install zsh --name ai   # or bash/fish
```
