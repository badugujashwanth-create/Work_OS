# 🚀 Quick Deployment Checklist

## Before You Deploy

### ✅ Step 1: Frontend Environment Variables in Netlify
Go to: **Netlify Dashboard → Site Settings → Build & Deploy → Environment Variables**

```
NEXT_PUBLIC_API_URL=https://zettalogix-workos.onrender.com/api
NEXT_PUBLIC_WS_URL=https://zettalogix-workos.onrender.com
NEXT_PUBLIC_INTERNAL_BROWSER_URL=https://www.google.com/
NEXT_PUBLIC_COMPANY_MAIL_URL=https://mail.google.com/mail
```

### ✅ Step 2: Backend Environment Variables
Go to your backend deployment service (Render, Heroku, etc.)

```
PORT=5000
MONGO_URI=memory
JWT_SECRET=1f9c0d7b8ac9e6f2b14d5a98cf36a711fb83b5982d7f4b0c6e2a9de83f4b7a66c1f39ac5bfa82c7d18c6e4c04c92d9e4e03f0a4b98fa476fbcd98fa7e4c21dd5
CLIENT_URL=http://localhost:3000,http://localhost:3001,https://zettalogix-workos.netlify.app,https://*--zettalogix-workos.netlify.app
OPENAI_API_KEY=JsCluEZHQE2PVNTAJ8bsBZMs8DfnMRRnyetXN-O5MZ3BXm3zJe3rd4TQ5slYKcOeug2H96TfJ5T3BlbkFJ69aHYKuBWuxbxKAHJBvhapslbH3T0-KOzlJYUtfsoH-YYuTxpVWYZ87juwYfQJrao_fvNFLFAA
OPENAI_MODEL=gpt-4o-mini
```

### ✅ Step 3: Deploy Frontend
```bash
git add .
git commit -m "Fix frontend-backend connection configuration"
git push origin main
```
Then Netlify will auto-deploy, or manually trigger deploy in dashboard.

### ✅ Step 4: Restart Backend
Most deployment platforms have a "Restart" button in the dashboard. Click it to apply new environment variables.

### ✅ Step 5: Test Connection
1. Open your Netlify URL in browser
2. Open DevTools (F12)
3. Go to Network tab
4. Try to login
5. Verify API request goes to: `https://zettalogix-workos.onrender.com/api/auth/login`

## If Something Goes Wrong

| Issue | Solution |
|-------|----------|
| 404 errors | Check `NEXT_PUBLIC_API_URL` matches backend URL |
| CORS errors | Check `CLIENT_URL` on backend includes frontend domain |
| 401 errors | Check JWT_SECRET is same on all instances |
| WebSocket fails | Check `NEXT_PUBLIC_WS_URL` is correct |
| Pages not loading | Check Netlify build logs for errors |

## Files Changed

- ✅ `frontend/.env.local` - Production URLs
- ✅ `frontend/.env.development` - Local dev URLs
- ✅ `frontend/.env.production` - Next.js build config
- ✅ `backend/.env` - Enhanced CORS
- ✅ `netlify.toml` - Documentation
- ✅ `DEPLOYMENT.md` - Complete guide
- ✅ `FIXES_SUMMARY.md` - This file

## Questions?

See `DEPLOYMENT.md` for complete deployment guide with troubleshooting.
