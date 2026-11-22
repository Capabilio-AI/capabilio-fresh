# Capabilio's language entries, loaded by Judge0's db/seeds.rb (the Dockerfile adds the require line). Judge0 rebuilds its language table from the
# seed on every start, so anything added another way (SQL by hand) disappears at the next reboot. Ids 101+ are ours; Judge0's own ids stay untouched.
# DOTNET_* settings: no globalization tables, no background GC thread, no diagnostics pipes, no write-xor-execute (fewer threads and mappings in the sandbox).
DOTNET_ENV = "DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 DOTNET_gcConcurrent=0 DOTNET_EnableDiagnostics=0 DOTNET_EnableWriteXorExecute=0 DOTNET_TieredPGO=0"

@languages ||= []
@languages += [
  { id: 101, name: "Java (OpenJDK 21)", is_archived: false, source_file: "Main.java",
    compile_cmd: "/usr/local/jdk-21/bin/javac %s Main.java", run_cmd: "/usr/local/jdk-21/bin/java Main" },
  { id: 102, name: "Python (3.12.16)", is_archived: false, source_file: "script.py",
    run_cmd: "/usr/local/python-3.12.16/bin/python3 script.py" },
  { id: 103, name: "JavaScript (Node.js 20.20.2)", is_archived: false, source_file: "script.js",
    run_cmd: "/usr/local/node-20/bin/node script.js" },
  { id: 104, name: "C# (.NET 10)", is_archived: false, source_file: "Main.cs",
    compile_cmd: "/usr/local/dotnet-10/csharp-build.sh", run_cmd: "#{DOTNET_ENV} /usr/local/dotnet-10/dotnet Main.dll" },
]
