#!/bin/bash

# Step 1: Build the Hugo blog
echo "Building the Hugo blog..."
hugo -s blog/

# Step 2: Create the build directory if it doesn't exist
mkdir -p build

# Step 3: Copy main site files to the build directory
echo "Copying main site files..."
cp -r * build/
rm -rf build/blog # Remove any previous blog output from the root copy

# Step 4: Ensure blog files remain in the correct folder
mv build/blog/* build/blog/

echo "Build process complete. Final structure in 'build' directory:"
ls -ltRh build/