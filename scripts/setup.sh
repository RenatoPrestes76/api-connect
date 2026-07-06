#!/usr/bin/env bash

# Development setup script
set -e

echo "🚀 Setting up Seltriva Connect development environment..."

# Check prerequisites
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed"
    exit 1
fi

echo "✓ Node.js $(node --version)"
echo "✓ pnpm $(pnpm --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Setup environment file
if [ ! -f .env.local ]; then
    echo ""
    echo "📝 Creating .env.local from .env.example..."
    cp .env.example .env.local
    echo "⚠️  Please update .env.local with your configuration"
fi

# Setup git hooks
echo ""
echo "🪝 Setting up git hooks..."
pnpm prepare

# Generate Prisma client
echo ""
echo "🗄️  Generating Prisma client..."
pnpm db:generate

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your configuration"
echo "2. Run: pnpm db:push (to sync database schema)"
echo "3. Run: pnpm dev (to start development servers)"
