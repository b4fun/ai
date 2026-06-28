{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  packages = with pkgs; [
    nodejs_26
    git
    vhs
  ];

  shellHook = ''
    export npm_config_prefix="$PWD/.npm-global"
    export PATH="$npm_config_prefix/bin:$PATH"

    repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
    demo_bin="$(mktemp -d)"
    cat > "$demo_bin/ai" <<EOF
#!/usr/bin/env bash
node "$repo_root/bin/ai.js" "\$@"
EOF
    chmod +x "$demo_bin/ai"
    export PATH="$demo_bin:$PATH"
  '';
}
