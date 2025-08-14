#!/bin/bash
# Exit immediately if a command fails
set -e

# Build the image
echo "🔨 Building auctionx-backend image..."
podman build -t auctionx-backend .

# Run the container
echo "🏃 Running auctionx-backend container..."
podman run -it --rm -p 3000:3000 auctionx-backend
