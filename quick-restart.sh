#!/bin/bash

# Quick Restart Script for Video Call Testing

echo "🔄 Restarting talent-IQ application..."

# Kill existing processes
echo "⏹️  Stopping backend..."
pkill -f "node.*backend" || true

echo "⏹️  Stopping frontend..."
pkill -f "vite" || true

sleep 2

# Verify .env files exist
echo "📋 Checking environment files..."

if [ ! -f "backend/.env" ]; then
    echo "❌ backend/.env not found. Creating from example..."
    cp backend/.env.example backend/.env
    echo "⚠️  Edit backend/.env with your credentials:"
    echo "   - STREAM_API_KEY=your_key"
    echo "   - STREAM_API_SECRET=your_secret"
fi

if [ ! -f "frontend/.env.local" ]; then
    echo "❌ frontend/.env.local not found. Creating..."
    cat > frontend/.env.local << 'EOF'
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key
VITE_API_URL=http://localhost:3000/api
VITE_STREAM_API_KEY=your_stream_key
EOF
    echo "⚠️  Edit frontend/.env.local with your credentials"
fi

# Verify credentials match
echo "🔐 Verifying credentials..."
BACKEND_KEY=$(grep "STREAM_API_KEY=" backend/.env | cut -d'=' -f2)
FRONTEND_KEY=$(grep "VITE_STREAM_API_KEY=" frontend/.env.local | cut -d'=' -f2)

if [ "$BACKEND_KEY" != "$FRONTEND_KEY" ]; then
    echo "⚠️  WARNING: Stream API keys don't match!"
    echo "   Backend:  $BACKEND_KEY"
    echo "   Frontend: $FRONTEND_KEY"
    echo ""
    echo "✅ Fix: Copy key from Stream dashboard to BOTH files"
fi

# Start backend
echo ""
echo "🚀 Starting backend server..."
cd backend
npm install > /dev/null 2>&1
npm start &
BACKEND_PID=$!

sleep 3

# Start frontend
echo "🚀 Starting frontend dev server..."
cd ../frontend
npm install > /dev/null 2>&1
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Services started!"
echo ""
echo "📍 Frontend: http://localhost:5173"
echo "📍 Backend:  http://localhost:3000"
echo ""
echo "🧪 Testing Steps:"
echo "1. Open http://localhost:5173 in Chrome"
echo "2. Open http://localhost:5173 in Brave (private window)"
echo "3. Create session in Chrome with different email"
echo "4. Join session in Brave"
echo "5. Look for 🔧 Debug Panel in bottom-right"
echo "6. Check all 4 tests show ✅ PASS"
echo ""
echo "🔴 If any test shows ❌ FAIL, the debug panel will tell you the exact problem"
echo ""
echo "Press Ctrl+C to stop servers"

wait
