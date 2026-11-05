{
  lib,
  stdenv,
  nodejs,
  pnpm,
  pnpmConfigHook,
  fetchPnpmDeps,
  makeWrapper,
}:
let
  manifest = lib.importJSON ../package.json;
in
stdenv.mkDerivation (finalAttrs: {
  pname = "cookbook-mcp";
  inherit (manifest) version;

  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../package.json
      ../pnpm-lock.yaml
      ../pnpm-workspace.yaml
      ../tsconfig.json
      ../scripts/bundle.ts
      ../src
    ];
  };

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    fetcherVersion = 5;
    hash = lib.removeSuffix "\n" (builtins.readFile ./pnpm-deps.hash);
  };

  nativeBuildInputs = [
    nodejs
    pnpm
    pnpmConfigHook
    makeWrapper
  ];

  buildPhase = ''
    runHook preBuild
    pnpm bundle
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    install -Dm644 dist/cookbook-mcp.js $out/lib/cookbook-mcp/cookbook-mcp.js
    makeWrapper ${lib.getExe nodejs} $out/bin/cookbook-mcp \
      --add-flags $out/lib/cookbook-mcp/cookbook-mcp.js

    runHook postInstall
  '';

  meta = {
    description = "Unofficial MCP server for CookBook Co.: recipes, tags, meal planner and shopping lists";
    homepage = "https://github.com/CarsonF/cookbook-co-mcp";
    license = lib.licenses.mit;
    mainProgram = "cookbook-mcp";
  };
})
