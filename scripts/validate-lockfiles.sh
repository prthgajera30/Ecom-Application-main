#!/bin/bash

# Lockfile Validation Script
# This script ensures lockfiles are in sync with package.json files before production builds

set -e

echo "🔍 Validating lockfiles..."

# Function to check if lockfile is in sync with package.json
validate_lockfile() {
    local dir=$1
    local package_json="$dir/package.json"
    local lockfile="$dir/pnpm-lock.yaml"

    if [ ! -f "$package_json" ]; then
        echo "⚠️  No package.json found in $dir"
        return 0
    fi

    if [ ! -f "$lockfile" ]; then
        echo "❌ No lockfile found in $dir"
        return 1
    fi

    echo "📦 Checking $dir..."

    # Try to install with frozen lockfile to validate sync
    if pnpm install --frozen-lockfile --silent; then
        echo "✅ Lockfile is in sync for $dir"
        return 0
    else
        echo "❌ Lockfile is out of sync for $dir"
        echo "🔧 Run 'pnpm install' to update lockfiles"
        return 1
    fi
}

# Validate root lockfile
validate_lockfile "."

# Validate workspace lockfiles
for dir in apps/*/; do
    if [ -f "$dir/package.json" ]; then
        validate_lockfile "$dir"
    fi
done

echo "🎉 Lockfile validation complete!"
