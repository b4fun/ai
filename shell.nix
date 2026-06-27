{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  packages = with pkgs; [
    nodejs_26
    git
  ];

  shellHook = ''
    export npm_config_prefix="$PWD/.npm-global"
    export PATH="$npm_config_prefix/bin:$PATH"
  '';
}
