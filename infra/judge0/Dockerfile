# Judge0 CE 1.13.1 ships Java 13, Python 3.8 and Node 12. Capabilio's lessons teach current syntax (records, switch expressions, match, ??), so this image
# ADDS current toolchains next to the old ones; the old language ids keep working. The new languages are registered by register-languages.sql.
# Every download is checked against its publisher's checksum, so a changed or tampered file fails the build instead of reaching students.
FROM judge0/judge0:1.13.1

ARG NODE_VERSION=v20.20.2
ARG JDK_URL=https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13.1%2B2/OpenJDK21U-jdk_x64_linux_hotspot_21.0.13.1_2.tar.gz
ARG PY_RELEASE=20261110
ARG DOTNET_VERSION=10.0.404
ARG DOTNET_SHA512=577d0eb17fec33d029104c5c63a1ab0accc3e28776274abef2218dbac5af18d2109b5406d26b31d76f5c245215e3ba0926a94c20246c672c41847c9e1eb1dc50
ARG PY_FILE=cpython-3.12.16+20261110-x86_64-unknown-linux-gnu-install_only.tar.gz

# the base image runs as the judge0 user; installing under /usr/local needs root, and the image must go back to judge0 afterwards
USER root
RUN set -eux; cd /tmp; \
    # Node.js
    curl -fsSLO "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.gz"; \
    curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt" | grep " node-${NODE_VERSION}-linux-x64.tar.gz\$" | sha256sum -c -; \
    mkdir /usr/local/node-20; tar -xzf "node-${NODE_VERSION}-linux-x64.tar.gz" --strip-components=1 -C /usr/local/node-20; \
    # Java (Temurin 21)
    curl -fsSL -o jdk.tar.gz "${JDK_URL}"; \
    echo "$(curl -fsSL "${JDK_URL}.sha256.txt" | cut -d' ' -f1)  jdk.tar.gz" | sha256sum -c -; \
    mkdir /usr/local/jdk-21; tar -xzf jdk.tar.gz --strip-components=1 -C /usr/local/jdk-21; \
    # Python 3.12 (relocatable build)
    curl -fsSL -o py.tar.gz "https://github.com/astral-sh/python-build-standalone/releases/download/${PY_RELEASE}/$(printf '%s' "${PY_FILE}" | sed 's/+/%2B/g')"; \
    echo "$(curl -fsSL "https://github.com/astral-sh/python-build-standalone/releases/download/${PY_RELEASE}/SHA256SUMS" | grep -F " ${PY_FILE}" | cut -d' ' -f1)  py.tar.gz" | sha256sum -c -; \
    tar -xzf py.tar.gz; mv python /usr/local/python-3.12.16; \
    rm -rf /tmp/*; \
    /usr/local/node-20/bin/node --version; /usr/local/jdk-21/bin/java -version; /usr/local/python-3.12.16/bin/python3 --version
# C# on the current .NET (the stock Mono cannot compile modern C#). The SDK ships its own compiler and reference assemblies, so no restore is needed.
RUN mkdir -p /usr/local/dotnet-10
RUN set -eux; cd /tmp; \
    curl -fsSL -o dotnet.tar.gz "https://builds.dotnet.microsoft.com/dotnet/Sdk/${DOTNET_VERSION}/dotnet-sdk-${DOTNET_VERSION}-linux-x64.tar.gz"; \
    echo "${DOTNET_SHA512}  dotnet.tar.gz" | sha512sum -c -; \
    tar -xzf dotnet.tar.gz -C /usr/local/dotnet-10; rm -rf /tmp/*; \
    /usr/local/dotnet-10/dotnet --version

# Our small files last, so editing them does not redo the big downloads above. Judge0 rebuilds its language table from db/seeds.rb on every start:
# capabilio-languages.rb adds ours to that list (a manual SQL insert would vanish at the next reboot).
COPY csharp-build.sh GlobalUsings.cs /usr/local/dotnet-10/
COPY capabilio-languages.rb /api/db/languages/capabilio.rb
RUN chmod 755 /usr/local/dotnet-10/csharp-build.sh \
 && sed -i "s#^require_relative 'languages/active'#require_relative 'languages/active'\\nrequire_relative 'languages/capabilio'#" /api/db/seeds.rb \
 && grep -q "languages/capabilio" /api/db/seeds.rb
USER judge0
