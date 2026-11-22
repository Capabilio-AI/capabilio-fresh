#!/bin/bash
# Compiles Main.cs with the .NET SDK's own Roslyn compiler (no NuGet restore, no project file, so it works inside Judge0's offline sandbox).
# GlobalUsings.cs gives the same implicit usings a new .NET project has, which is what the lessons assume.
# Judge0's sandbox caps threads and memory; .NET by default starts a thread per core and reserves a large heap, so keep both small.
export DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1
export DOTNET_PROCESSOR_COUNT=1 DOTNET_gcConcurrent=0 DOTNET_TieredPGO=0 DOTNET_EnableDiagnostics=0
# .NET 7+ maps its code memory twice (write-xor-execute); that needs shared memory the sandbox does not provide and shows up as "Out of memory"
export DOTNET_EnableWriteXorExecute=0
D=/usr/local/dotnet-10
CSC=$(ls "$D"/sdk/*/Roslyn/bincore/csc.dll | head -1)
REFDIR=$(ls -d "$D"/packs/Microsoft.NETCore.App.Ref/*/ref/net10.0 | head -1)
RUNTIME=$(ls "$D/shared/Microsoft.NETCore.App" | head -1)
"$D/dotnet" "$CSC" -nologo -langversion:latest -nullable:enable -optimize+ -target:exe -out:Main.dll \
  $(ls "$REFDIR"/*.dll | sed 's/^/-r:/') "$D/GlobalUsings.cs" Main.cs || exit 1
printf '{"runtimeOptions":{"tfm":"net10.0","framework":{"name":"Microsoft.NETCore.App","version":"%s"}}}' "$RUNTIME" > Main.runtimeconfig.json
