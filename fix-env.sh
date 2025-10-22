#!/bin/bash

# Update PROJECT_PATH in .env to current directory
CURRENT_DIR=$(pwd)

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please copy .env.example to .env and configure it."
    exit 1
fi

# Update PROJECT_PATH
if grep -q "^PROJECT_PATH=" .env; then
    # macOS compatible sed
    sed -i '' "s|^PROJECT_PATH=.*|PROJECT_PATH=$CURRENT_DIR|g" .env
    echo "✅ Updated PROJECT_PATH to: $CURRENT_DIR"
else
    echo "PROJECT_PATH=$CURRENT_DIR" >> .env
    echo "✅ Added PROJECT_PATH: $CURRENT_DIR"
fi

echo ""
echo "Updated .env file:"
grep "^PROJECT_PATH=" .env
