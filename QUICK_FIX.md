# 🎥 Video Call - Quick Fix Guide

## 🚀 Quick Start (Do This First!)

### 1. Verify Environment Variables
```bash
# backend/.env - Must have:
STREAM_API_KEY=your_actual_key_from_dashboard
STREAM_API_SECRET=your_actual_secret

# frontend/.env.local - Must have:
VITE_STREAM_API_KEY=same_key_as_above
VITE_API_URL=http://localhost:3000/api
```

### 2. Restart Services
```bash
# Kill old processes
pkill -f "node.*backend" || true
pkill -f "vite" || true

# Start backend (Terminal 1)
cd /home/skinny-ke/Desktop/talent-IQ/backend
npm start

# Start frontend (Terminal 2)
cd /home/skinny-ke/Desktop/talent-IQ/frontend
npm run dev
```

### 3. Test in Two Browsers
- Browser 1 (Chrome): http://localhost:5173 → Login with Email A
- Browser 2 (Brave): http://localhost:5173 → Login with Email B

### 4. Create & Join Session
- Chrome: Create session
- Brave: Join session

### 5. Look for 🔧 Debug Panel (Bottom-Right Corner)

---

## 🔍 What Debug Panel Shows

| Test | Result | What It Means |
|------|--------|--------------|
| Media Access | ✅ PASS | Camera & Microphone working |
| Media Access | ❌ FAIL | Browser blocked permissions |
| Stream API Key | ✅ PASS | .env configured correctly |
| Stream API Key | ❌ FAIL | Missing VITE_STREAM_API_KEY |
| Media Devices | ✅ PASS | Hardware available |
| Media Devices | ❌ FAIL | No camera/mic detected |

---

## ❌ If Debug Panel Shows FAIL

### Media Access FAIL?
```bash
# Fix in browser:
1. Settings → Privacy and security
2. Find localhost:5173
3. Set Camera: Allow
4. Set Microphone: Allow
5. Reload page (F5)

# OR try incognito mode
# OR clear site data and reload
```

### Stream API Key FAIL?
```bash
# Frontend .env.local missing or wrong:
1. Go to https://dashboard.getstream.io/
2. Login → Applications → Copy API Key
3. Add to frontend/.env.local:
   VITE_STREAM_API_KEY=your_copied_key
4. Restart frontend: npm run dev
```

### Media Devices FAIL?
```bash
# Hardware issue:
1. System Settings → Sound
2. Verify microphone shows
3. Verify camera detected
4. Try different device/browser
```

---

## 📋 Checklist

- [ ] Backend .env has STREAM_API_KEY & STREAM_API_SECRET
- [ ] Frontend .env.local has VITE_STREAM_API_KEY (same as backend)
- [ ] Backend running: `npm start` in /backend
- [ ] Frontend running: `npm run dev` in /frontend
- [ ] Both showing in console: `✅` messages (not ❌)
- [ ] Browser allows camera/microphone for localhost:5173
- [ ] Debug panel shows 4/4 ✅ PASS
- [ ] Cameras/microphones detected in system

---

## 💭 Still Stuck?

### Check Browser Console (F12 → Console)
Look for these patterns:

**✅ Good:**
```
✅ Stream token obtained
✅ Stream client initialized
✅ Call joined successfully
✅ Camera and microphone enabled
```

**❌ Problem:**
```
❌ Error: Stream API key is not provided
❌ Failed to join video call
❌ Permission denied: camera
```

### Run Permission Test
```javascript
// Paste in browser console:
navigator.mediaDevices.getUserMedia({ audio: true, video: true })
  .then(stream => {
    console.log("✅ OK - Tracks:", stream.getTracks().map(t => t.kind));
    stream.getTracks().forEach(t => t.stop());
  })
  .catch(err => console.error("❌ ERROR:", err.name, err.message));
```

Expected: `✅ OK - Tracks: audio, video`

### Check API Connection
```javascript
// Paste in browser console:
fetch('http://localhost:3000/api/chat/token', {
  headers: { 'Authorization': 'Bearer YOUR_CLERK_TOKEN' }
})
  .then(r => r.json())
  .then(d => console.log("✅ Token received:", d))
  .catch(e => console.error("❌ Failed:", e.message));
```

Expected: Should show token, userId, userName

---

## 📞 Still Need Help?

1. **Screenshot the debug panel** - Shows current state
2. **Screenshot console errors** - F12 → Console
3. **Check browser console for log messages** - Look for ✅/❌
4. **Verify credentials** - Are they same as in Stream dashboard?
5. **Try different network** - Rule out firewall blocking WebRTC

---

**Most Common Fixes:**
1. Browser permissions (50%) - Allow camera/mic
2. Wrong API key (30%) - Copy from dashboard
3. Not restarted services (15%) - npm start again
4. Network firewall (5%) - Try different WiFi/VPN

**First try the debug panel - it tells you exactly what's wrong!** 🔧
