# Build Instructions

This guide covers how to set up the development environment and build Handy from source across different platforms.

## Prerequisites

### All Platforms

- [Rust](https://rustup.rs/) (latest stable)
- [Bun](https://bun.sh/) package manager
- [Tauri Prerequisites](https://tauri.app/start/prerequisites/)

### Platform-Specific Requirements

#### macOS

- Xcode Command Line Tools
- Install with: `xcode-select --install`

#### Windows

- Microsoft C++ Build Tools
- Visual Studio 2019/2022 with C++ development tools
- Or Visual Studio Build Tools 2019/2022

#### Linux

- Build essentials
- ALSA development libraries
- Install with:

  ```bash
  # Ubuntu/Debian
  sudo apt update
  sudo apt install build-essential libasound2-dev pkg-config libssl-dev libvulkan-dev vulkan-tools glslc libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf cmake

  # Fedora/RHEL
  sudo dnf groupinstall "Development Tools"
  sudo dnf install alsa-lib-devel pkgconf openssl-devel vulkan-devel \
    gtk3-devel webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel

  # Arch Linux
  sudo pacman -S base-devel alsa-lib pkgconf openssl vulkan-devel \
    gtk3 webkit2gtk-4.1 libappindicator-gtk3 librsvg
  ```

## Environment Setup

Handy requires several system-level dependencies for audio processing and GUI rendering on Linux. We provide an automated setup script to check for these dependencies.

```bash
# Using npm
npm run setup

# Or using bun
bun run setup

# Or directly
bash scripts/setup.sh
```

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/groxaxo/Handy.git
cd Handy
```

### 2. Run Setup

This will check for required package managers (Bun/NPM), Rust, and system libraries.

```bash
npm run setup
```

### 3. Install Dependencies

```bash
npm install # or bun install
```

### 4. Start Dev Server

```bash
npm run tauri dev # or bun tauri dev
```
