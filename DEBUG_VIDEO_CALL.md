# Video Call Debugging Guide

## Issue: Both participants stuck on "Connecting to video call" without camera/microphone permission request

### Steps to Debug:

#### 1. **Check Browser Console for Errors**
- Open Chrome DevTools (F12 or Right-click → Inspect → Console)
- Look for any error messages starting with ❌
- Take screenshots of errors and share them

#### 2. **Verify Environment Variables**
Backend (.env):
```bash
- STREAM_API_KEY=??? (should be populated)
- STREAM_API_SECRET=??? (should be populated)
```

Frontend (.env.local):
```bash
- VITE_STREAM_API_KEY=??? (must match backend STREAM_API_KEY)
- VITE_API_URL=http://localhost:3000/api
```

#### 3. **Check Stream API Credentials**
1. Go to https://dashboard.getstream.io/
2. Sign in to your account
3. Navigate to Applications
4. Copy your **API Key** and verify it matches your .env files
5. Check if API Key is correct in both backend and frontend

#### 4. **Test Media Permissions**
Run this in your browser console:
```javascript
navigator.mediaDevices.getUserMedia({ audio: true, video: true })
  .then(stream => {
    console.log("✅ Permissions granted! Tracks:", stream.getTracks().map(t => t.kind));
    stream.getTracks().forEach(t => t.stop());
  })
  .catch(err => {
    console.error("❌ Permissions denied:", err.name, err.message);
  });
```

**Expected Results:**
- ✅ **Success**: Should show audio and video tracks
- ❌ **NotAllowedError**: User denied permissions (check browser settings)
- ❌ **NotFoundError**: No camera/microphone detected
- ❌ **NotSecureError**: HTTPS required (if on non-localhost)

#### 5. **Test Network Connectivity**
Run this in browser console to check if Stream API is reachable:
```javascript
fetch('https://api.stream-io-api.com/api/v1/health', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
})
  .then(r => r.json())
  .then(d => console.log("✅ Stream API healthy:", d))
  .catch(e => console.error("❌ Stream API unreachable:", e));
```

#### 6. **Check Backend Token Generation**
Look at browser Network tab (F12 → Network):
1. Create a session
2. Join session
3. Look for request to `/api/chat/token`
4. Check Response tab - should contain:
   ```json
   {
     "token": "eyJ...",
     "userId": "user_123",
     "userName": "Your Name",
     "userImage": "..."
   }
   ```

#### 7. **Test Stream Call Creation**
In browser console:
```javascript
const logs = [];
// Check if Stream client initialized
console.log("Stream API Key available:", !!import.meta.env.VITE_STREAM_API_KEY);

// Look for these logs in console:
// ✅ Stream token obtained
// ✅ Stream client initialized
// Joining call: session_xxx
// ✅ Call joined successfully
```

### Common Issues & Solutions:

| Issue | Solution |
|-------|----------|
| ❌ "Stream API key is not provided" | Verify VITE_STREAM_API_KEY in frontend .env.local |
| ❌ Permission denied (NotAllowedError) | 1. Check browser permissions settings<br>2. Try incognito mode<br>3. Restart browser |
| ❌ Call stuck on "Joining" | 1. Check firewall (WebRTC requires UDP)<br>2. Try different network<br>3. Verify Stream credentials |
| Camera/mic permission never asked | Check if already denied in browser settings |

### Quick Fix Checklist:

- [ ] Both .env files have valid Stream API credentials
- [ ] Frontend and backend have same VITE_STREAM_API_KEY / STREAM_API_KEY
- [ ] Browser console shows ✅ logs during call join
- [ ] `/api/chat/token` returns valid token
- [ ] Media permissions test passes
- [ ] Using HTTPS or localhost (required by browser security)
- [ ] No VPN/Proxy blocking WebRTC
- [ ] Using supported browser (Chrome, Firefox, Safari, Edge)

### Still Stuck?

1. **Restart backend server** - `npm start` in /backend
2. **Clear browser cache** - Ctrl+Shift+Delete (clear all data)
3. **Restart browser** completely
4. **Try incognito window** - Rules out extensions
5. **Test with Chrome on desktop** first (most compatible)

### Advanced Debug Mode:
Add this to the top of `VideoCallUI.jsx`:
```javascript
useEffect(() => {
  const originalError = console.error;
  console.error = (...args) => {
    console.log("🔴 ERROR:", ...args);
    originalError(...args);
  };
}, []);
```

This will log all errors prominently in console.
