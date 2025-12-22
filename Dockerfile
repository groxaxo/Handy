# Dockerfile for building and launching Handy on Linux (Headless/CPU)
FROM node:20-bookworm

# Avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install Rust toolchain
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable \
    && chmod -R a+w $RUSTUP_HOME $CARGO_HOME

# Install System Dependencies (Build + Runtime + Headless)
# Matches the list in scripts/setup.sh + standard build tools + bindgen requirements
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libasound2-dev \
    pkg-config \
    libssl-dev \
    libvulkan-dev \
    vulkan-tools \
    glslc \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    patchelf \
    cmake \
    curl \
    wget \
    file \
    xvfb \
    xauth \
    libnss3 \
    libxtst6 \
    libxss1 \
    libxrandr2 \
    libasound2 \
    libclang-dev \
    clang \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for caching
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Set environment variables for CPU-only and Headless execution
ENV DISPLAY=:99
ENV WEBKIT_DISABLE_COMPOSITING_MODE=1

# Expose port 1420 for Vite (if needed)
EXPOSE 1420

# Command to build and then launch headlessly for verification
# We use xvfb-run to provide a virtual display
CMD ["bash", "-c", "npm run tauri build -- --debug && xvfb-run -a npm run tauri dev"]
