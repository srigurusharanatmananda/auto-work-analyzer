#!/bin/bash

# Auto Work Analyzer Installation Script
# Installs and configures Auto Work Analyzer for any project

set -e

echo "🎯 Auto Work Analyzer Installation"
echo "==================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm $(npm -v) detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Create logs directory
if [ ! -d "logs" ]; then
    mkdir -p logs
    echo "✅ Created logs directory"
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from template..."
    if [ -f "env.example" ]; then
        cp env.example .env
        echo "✅ Created .env file from template"
        echo ""
        echo "📝 Please edit .env file with your ClickUp credentials:"
        echo "   - CLICKUP_TEAM_ID"
        echo "   - CLICKUP_API_KEY"
        echo "   - CLICKUP_DEFAULT_LIST_ID (optional)"
        echo ""
        echo "   Then run: npm run test"
    else
        echo "❌ No env.example file found. Please create .env file manually."
        exit 1
    fi
else
    echo "✅ .env file found"
fi

# Build the project
echo "🔨 Building project..."
npm run build
echo "✅ Project built successfully"
echo ""

# Test configuration
echo "🧪 Testing configuration..."
if npm run test > /dev/null 2>&1; then
    echo "✅ Configuration test passed"
else
    echo "⚠️  Configuration test failed. Please check your .env file."
    echo "   Run 'npm run test' for detailed error messages."
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Edit .env file with your ClickUp credentials"
echo "   2. Run 'npm run test' to verify configuration"
echo "   3. Run 'npm run analyze today' to analyze today's work"
echo "   4. Run 'npm run webhook' to start webhook server"
echo ""
echo "📚 Documentation: README.md"
echo "🆘 Support: GitHub Issues"
echo ""


















