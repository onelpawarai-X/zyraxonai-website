FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    WORKSPACE_ROOT=/workspace \
    ARTIFACT_ROOT=/workspace/.artifacts \
    RUNNER_PORT=8787

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash ca-certificates curl git python3 python3-pip build-essential pkg-config \
    zip unzip tar gzip openjdk-17-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# PowerShell lives inside this isolated runner image, never on the user's machine.
RUN curl -fsSL https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb -o /tmp/packages-microsoft-prod.deb \
    && dpkg -i /tmp/packages-microsoft-prod.deb \
    && rm /tmp/packages-microsoft-prod.deb \
    && apt-get update \
    && apt-get install -y --no-install-recommends powershell \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin runner \
    && mkdir -p /workspace/.artifacts /workspace/.cache /workspace/.home \
    && chown -R runner:runner /workspace

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts
COPY server.mjs ./server.mjs

USER runner
EXPOSE 8787
VOLUME ["/workspace"]

CMD ["node", "server.mjs"]
