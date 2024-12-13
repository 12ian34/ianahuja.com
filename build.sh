#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status.

# Step 1: Clean up the build directory to prevent recursion
echo "Cleaning up the build directory..."
rm -rfv build/

# Step 2: Build the Hugo blog
echo "Building the Hugo blog..."
hugo -s blog/ -d ../build/blog

# Step 3: Copy main site files to the build directory
echo "Copying main site files..."
mkdir -p build
shopt -s extglob  # Enable extended pattern matching
cp -rv !(build|blog) build/  # Exclude build and blog folders from being copied

# Step 4: Final structure check
echo "Build process complete. Final structure in 'build' directory:"
ls -ltRv build/