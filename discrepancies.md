# Installation and Setup Discrepancies

This document logs discrepancies found while following the installation and build instructions for the Handy repository.

## Environment Information

- **OS**: Linux (from metadata)
- **Local Time**: 2025-12-22T04:07:49Z

## Discrepancies

### 1. Package Manager
- **Instruction**: `BUILD.md` specifies using `bun`.
- **Observation**: `bun` is not installed on the system. `npm` (v10.8.2) and `node` are available.
- **Action**: Used `npm install` instead of `bun install`. This worked for the frontend dependencies.

### 2. Node Version
- **Observation**: Node version is `v20.19.6`. Compatible with the project.

### 3. Rust Version
- **Observation**: `rustc` and `cargo` were initially missing.
- **Resolution**: Installed `rustup` successfully. `rustc 1.92.0` is now available.

### 4. System Dependencies (Linux)
- **Observation**: Checked for libraries required by Tauri/Handy.
- **Missing**: `libasound2-dev`, `pkg-config`, `libvulkan-dev`, `vulkan-tools`, `glslc`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`, `cmake`.
- **Installed**: `libssl-dev`.
- **Action**: Documented requirement in `README.md` and provided `scripts/setup-env.sh`.

### 5. Dependency Installation (`npm install`)
- **Status**: Completed successfully. Frontend toolchain (Vite, Prettier, etc.) is functional.

### 6. Build Status
- **Status**: Backend build (`cargo check`) fails due to missing system headers (X11, GLib, etc.) and `pkg-config`.
- **Recommended Action**: Users must install system dependencies using the provided `scripts/setup-env.sh` (requires `sudo`).

