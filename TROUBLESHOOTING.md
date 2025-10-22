# 🔧 Troubleshooting Guide

## Common Issues and Solutions

### ❌ Issue: "Unexpected token '<', "<!DOCTYPE"..." Error

**Symptoms:**
- 500 Internal Server Error when clicking "Analyze Commits" or "Process Notes"
- Console shows: `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

**Cause:**
The backend server is not running, or there's a configuration error.

**Solution:**

1. **Make sure backend server is running:**
   ```bash
   # In terminal 1
   npm run webhook
   ```

   You should see:
   ```
   🚀 Auto Work Analyzer webhook server running on port 3000
   📡 Health check: http://localhost:3000/health
   📊 Analysis endpoint: http://localhost:3000/analyze
   📝 Notes endpoint: http://localhost:3000/notes
   ```

2. **Check your `.env` file exists** in the root directory with:
   ```bash
   CLICKUP_TEAM_ID=your_team_id
   CLICKUP_API_KEY=pk_your_api_key
   CLICKUP_DEFAULT_LIST_ID=your_list_id
   CLICKUP_DEFAULT_ASSIGNEE=zacchaeus.napuo@uskfoundation.or.ke
   ```

3. **Test backend directly:**
   ```bash
   curl http://localhost:3000/health
   ```

   Should return:
   ```json
   {"status":"healthy","timestamp":"...","version":"1.0.0"}
   ```

4. **If backend won't start**, rebuild it:
   ```bash
   npm run build
   npm run webhook
   ```

---

### 👁️ Issue: Text in Input Fields Not Visible

**Symptoms:**
- Can't see what you're typing in date fields, email fields, or text areas
- Text appears to be white on white background

**Solution:**

✅ **Fixed!** The CSS has been updated to force dark text in all input fields.

If you still have issues:

1. **Clear browser cache:**
   - Chrome/Edge: Ctrl+Shift+Delete (Cmd+Shift+Delete on Mac)
   - Or hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)

2. **Restart the UI dev server:**
   ```bash
   cd ui
   rm -rf .next
   npm run dev
   ```

---

### 🌐 Issue: CORS Errors

**Symptoms:**
- Browser console shows CORS policy errors
- Requests blocked due to CORS

**Solution:**

✅ **Fixed!** The backend now has proper CORS configuration for both ports 3000 and 3001.

If you still see CORS errors:

1. **Check both servers are running:**
   - Backend on port 3000
   - UI on port 3001

2. **Clear browser cache and restart servers**

---

### 🔄 Issue: Changes Not Appearing

**Symptoms:**
- Made changes to code but don't see them in the browser

**Solution:**

1. **For UI changes:**
   ```bash
   cd ui
   rm -rf .next
   npm run dev
   ```

2. **For backend changes:**
   ```bash
   npm run build
   # Then restart webhook server (Ctrl+C and npm run webhook)
   ```

3. **Hard refresh browser:**
   - Chrome/Edge: Ctrl+Shift+R (Cmd+Shift+R on Mac)
   - Or open DevTools and right-click refresh → "Empty Cache and Hard Reload"

---

### 🚫 Issue: Port Already in Use

**Symptoms:**
- Error: `EADDRINUSE: address already in use :::3000` or `:::3001`

**Solution:**

1. **Find and kill the process:**

   **For port 3000 (backend):**
   ```bash
   # On Mac/Linux
   lsof -ti:3000 | xargs kill -9

   # On Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

   **For port 3001 (UI):**
   ```bash
   # On Mac/Linux
   lsof -ti:3001 | xargs kill -9

   # On Windows
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F
   ```

2. **Or change the ports:**

   For UI, edit `ui/package.json`:
   ```json
   "dev": "next dev -p 3002"
   ```

   For backend, edit `.env`:
   ```
   WEBHOOK_PORT=3005
   ```

---

### 📝 Issue: ClickUp Tasks Not Being Created

**Symptoms:**
- Analysis works but tasks don't appear in ClickUp
- Or error about ClickUp API

**Solution:**

1. **Verify ClickUp credentials:**
   ```bash
   # Check .env file
   cat .env
   ```

   Make sure:
   - `CLICKUP_API_KEY` starts with `pk_`
   - `CLICKUP_TEAM_ID` is correct
   - `CLICKUP_DEFAULT_LIST_ID` is correct

2. **Test ClickUp connection:**
   ```bash
   npm test
   ```

3. **Check ClickUp API key permissions:**
   - Go to ClickUp → Settings → Apps
   - Make sure API token has proper permissions
   - Regenerate if needed

---

### 🔐 Issue: Tasks Not Assigned to Sri Gurusharanatmananda

**Symptoms:**
- Tasks created but not assigned
- Or assigned to wrong person

**Solution:**

1. **Verify email in .env:**
   ```bash
   grep CLICKUP_DEFAULT_ASSIGNEE .env
   ```

   Should show:
   ```
   CLICKUP_DEFAULT_ASSIGNEE=zacchaeus.napuo@uskfoundation.or.ke
   ```

2. **Verify email exists in ClickUp:**
   - Email must match exactly what's in ClickUp workspace
   - Check for typos

3. **Rebuild backend after env changes:**
   ```bash
   npm run build
   # Restart webhook server
   ```

---

### 🧪 Issue: Development Server Issues

**Symptoms:**
- Hot reload not working
- Changes not showing up
- Random errors

**Solution:**

1. **Clean everything and restart:**
   ```bash
   # Stop all servers (Ctrl+C in both terminals)

   # Clean UI
   cd ui
   rm -rf .next node_modules
   npm install

   # Clean backend
   cd ..
   rm -rf dist node_modules
   npm install
   npm run build

   # Start fresh
   # Terminal 1
   npm run webhook

   # Terminal 2
   cd ui && npm run dev
   ```

---

## 🆘 Quick Diagnostic Commands

Run these to check your setup:

```bash
# 1. Check Node.js version (need 18+)
node --version

# 2. Check if backend dependencies installed
npm list express typescript

# 3. Check if UI dependencies installed
cd ui && npm list next react

# 4. Check if .env file exists
test -f .env && echo "✅ .env exists" || echo "❌ .env missing"

# 5. Check if backend compiles
npm run build

# 6. Test backend health
curl http://localhost:3000/health

# 7. Check ports in use
lsof -i :3000 -i :3001
```

---

## 📞 Still Having Issues?

### Check These:

1. **Node.js Version:**
   ```bash
   node --version
   # Should be 18.0.0 or higher
   ```

2. **Git Repository:**
   ```bash
   git status
   # Should show you're in a git repo
   ```

3. **Backend Logs:**
   - Look at the terminal where `npm run webhook` is running
   - Any errors will show there

4. **Browser Console:**
   - F12 → Console tab
   - Look for red errors

5. **Network Tab:**
   - F12 → Network tab
   - Try the action again
   - Look at failed requests

---

## 🎯 The Working Setup

When everything is working correctly, you should see:

### Terminal 1 (Backend):
```
🚀 Auto Work Analyzer webhook server running on port 3000
📡 Health check: http://localhost:3000/health
🔗 Webhook endpoint: http://localhost:3000/webhook
📊 Analysis endpoint: http://localhost:3000/analyze
📝 Notes endpoint: http://localhost:3000/notes

Press Ctrl+C to stop the server
```

### Terminal 2 (UI):
```
  ▲ Next.js 15.5.6
  - Local:        http://localhost:3001
  - Network:      http://192.168.1.x:3001

 ✓ Ready in 2.5s
```

### Browser:
- Open http://localhost:3001
- See welcome toast: "👋 Welcome! All tasks will be assigned..."
- Input fields show dark text (not invisible)
- Clicking buttons shows loading toasts
- Actions complete with success toasts

---

## 🔍 Debug Checklist

- [ ] Backend server running on port 3000
- [ ] UI dev server running on port 3001
- [ ] `.env` file exists with correct values
- [ ] ClickUp API key is valid (starts with `pk_`)
- [ ] Can access http://localhost:3000/health
- [ ] Can access http://localhost:3001
- [ ] Browser console shows no CORS errors
- [ ] Input fields show dark text (visible)
- [ ] No port conflicts (nothing else on 3000/3001)

---

**Last Updated:** 2025-10-22

If you're still stuck after trying these solutions, please check:
- All environment variables in `.env`
- Backend terminal for error messages
- Browser console for detailed errors
