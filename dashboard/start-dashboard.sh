#!/bin/bash

# Gigaverse Bot Dashboard Startup Script

echo "🎮 Starting Gigaverse Bot Dashboard..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js to run the dashboard."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm to run the dashboard."
    exit 1
fi

# Navigate to dashboard directory
cd "$(dirname "$0")"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the dashboard server
echo "🚀 Launching dashboard server..."
echo "📱 Dashboard will be available at: http://localhost:3000"
echo "📡 WebSocket server will run on: ws://localhost:3001"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
npm start