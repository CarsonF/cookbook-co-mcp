{
  description = "Unofficial MCP server for CookBook Co.";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      packages = forAllSystems (pkgs: rec {
        cookbook-co-mcp = pkgs.callPackage ./nix/package.nix { };
        default = cookbook-co-mcp;
      });

      apps = forAllSystems (pkgs: rec {
        cookbook-co-mcp = {
          type = "app";
          program = pkgs.lib.getExe self.packages.${pkgs.stdenv.hostPlatform.system}.default;
        };
        default = cookbook-co-mcp;
      });

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [
            pkgs.nodejs
            pkgs.pnpm
          ];
          shellHook = ''
            git rev-parse --git-dir >/dev/null 2>&1 && git config core.hooksPath .githooks
          '';
        };
      });
    };
}
