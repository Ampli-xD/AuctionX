#!/bin/bash
# Exit immediately if a command fails
set -e

# Build the image
echo "🔨 Building auctionx image..."
podman build -t auctionx .

# Run the container
echo "🏃 Running auctionx container..."
podman run -it --rm -p 5173:5173 auctionx
