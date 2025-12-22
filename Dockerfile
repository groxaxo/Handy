# Dockerfile for building Handy on Linux
# usage: docker build -t handy-builder .
# usage: docker run -v $(pwd):/app handy-builder npm run tauri build

FROM node:20-bookworm

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Rust toolchain
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable \
    && chmod -R a+w $RUSTUP_HOME $CARGO_HOME

# Install System Dependencies
# Matches the list in scripts/setup.sh + standard build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libasound2-dev \
    pkg-config \
    libssl-dev \
    libvulkan-dev \
    vulkan-tools \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    patchelf \
    cmake \
    curl \
    wget \
    file \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for caching
COPY package*.json ./

# Install frontend dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Default command: build the app
# Output will be in src-tauri/target/release/bundle/deb/ and /appimage/
CMD ["npm", "run", "tauri", "build"]
