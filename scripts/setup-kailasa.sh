#!/bin/bash

# Setup Auto Work Analyzer for Kailasa Store project
# This script configures the analyzer to work with the existing Kailasa Store project

set -e

echo "🎯 Setting up Auto Work Analyzer for Kailasa Store"
echo "=================================================="
echo ""

# Get the current directory (should be auto-work-analyzer)
CURRENT_DIR=$(pwd)
KAILASA_DIR="/Users/zacchaeusnapuo/Documents/GitHub/kailasa-store"

echo "📁 Current directory: $CURRENT_DIR"
echo "📁 Kailasa Store directory: $KAILASA_DIR"
echo ""

# Check if Kailasa Store directory exists
if [ ! -d "$KAILASA_DIR" ]; then
    echo "❌ Kailasa Store directory not found: $KAILASA_DIR"
    exit 1
fi

echo "✅ Kailasa Store directory found"

# Copy environment variables from Kailasa Store
if [ -f "$KAILASA_DIR/.env" ]; then
    echo "📋 Copying environment variables from Kailasa Store..."
    cp "$KAILASA_DIR/.env" "$CURRENT_DIR/.env"
    echo "✅ Environment variables copied"
else
    echo "⚠️  No .env file found in Kailasa Store directory"
    echo "   Please create .env file manually with ClickUp credentials"
fi

# Update project path in .env
if [ -f "$CURRENT_DIR/.env" ]; then
    echo "🔧 Updating project path in .env..."
    sed -i '' "s|PROJECT_PATH=.*|PROJECT_PATH=$KAILASA_DIR|g" "$CURRENT_DIR/.env"
    echo "✅ Project path updated"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"

# Build the project
echo "🔨 Building project..."
npm run build
echo "✅ Project built successfully"

# Test configuration
echo "🧪 Testing configuration..."
if npm run test > /dev/null 2>&1; then
    echo "✅ Configuration test passed"
else
    echo "⚠️  Configuration test failed. Please check your .env file."
    echo "   Run 'npm run test' for detailed error messages."
fi

echo ""
echo "🎉 Setup complete for Kailasa Store!"
echo ""
echo "📋 Usage examples:"
echo "   npm run analyze today                    # Analyze today's work"
echo "   npm run analyze range 2024-01-15 2024-01-16  # Analyze date range"
echo "   npm run analyze author developer@example.com  # Analyze by author"
echo "   npm run webhook                         # Start webhook server"
echo "   npm run test                            # Test configuration"
echo ""
echo "🔗 Integration options:"
echo "   1. Command line: npm run analyze today"
echo "   2. Webhook server: npm run webhook"
echo "   3. Git hooks: Copy scripts/git-hooks/post-commit to .git/hooks/"
echo "   4. Cron job: Add to crontab for scheduled analysis"
echo ""
echo "📚 Documentation: README.md"
echo "🆘 Support: GitHub Issues"
echo ""

