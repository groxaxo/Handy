# setup.sh: Automate environment setup for Handy

set -e

echo "🔍 Checking environment for Handy..."

# 1. Check for NPM/Node
if command -v npm >/dev/null 2>&1; then
    echo "✅ npm is installed ($(npm -v))"
else
    echo "❌ npm is not installed. Please install Node.js."
    exit 1
fi

# 2. Check for Bun (Recommended in BUILD.md)
if command -v bun >/dev/null 2>&1; then
    echo "✅ bun is installed ($(bun -v))"
else
    echo "⚠️  bun is not installed. BUILD.md recommends it."
    read -p "Do you want to install bun now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        curl -fsSL https://bun.sh/install | bash
        export PATH="$HOME/.bash/bin:$PATH" # Basic path update, might need manual reload
    fi
fi

# 3. Check for Rust/Cargo
if command -v cargo >/dev/null 2>&1; then
    echo "✅ cargo is installed ($(cargo --version))"
else
    echo "⚠️  cargo/rust is not installed."
    read -p "Do you want to install rustup now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
    fi
fi

# 4. Check for System Libraries (Ubuntu/Debian)
if command -v apt-get >/dev/null 2>&1; then
    echo "📦 Checking system libraries (apt)..."
    LIBS=(
        "build-essential"
        "libasound2-dev"
        "pkg-config"
        "libssl-dev"
        "libvulkan-dev"
        "vulkan-tools"
        "shaderc"
        "glslc"
        "libgtk-3-dev"
        "libwebkit2gtk-4.1-dev"
        "libayatana-appindicator3-dev"
        "librsvg2-dev"
        "patchelf"
        "cmake"
    )
    
    MISSING_LIBS=()
    for lib in "${LIBS[@]}"; do
        if ! dpkg -l | grep -q "^ii  $lib"; then
            MISSING_LIBS+=("$lib")
        fi
    done
    
    if [ ${#MISSING_LIBS[@]} -eq 0 ]; then
        echo "✅ All required system libraries are installed."
    else
        echo "❌ Missing system libraries: ${MISSING_LIBS[*]}"
        echo "Run the following to fix:"
        echo "sudo apt update && sudo apt install -y ${MISSING_LIBS[*]}"
    fi
else
    echo "⚠️  Non-apt system detected. Please refer to BUILD.md for system dependencies."
fi

echo "🚀 Environment check complete. Review the output above for any remaining steps."
