# Deployment Configuration Guide

## Frontend (Netlify Deployment)

### Important: Environment Variables Setup

Before deploying, ensure all environment variables are properly configured in Netlify:

**In Netlify Dashboard:**
1. Go to: Site Settings → Build & Deploy → Environment
2. Add/Update these variables:

```
NEXT_PUBLIC_API_URL=https://zettalogix-workos.onrender.com/api
NEXT_PUBLIC_WS_URL=https://zettalogix-workos.onrender.com
NEXT_PUBLIC_INTERNAL_BROWSER_URL=https://www.google.com/
NEXT_PUBLIC_COMPANY_MAIL_URL=https://mail.google.com/mail
```

### Local Development

For local development, the `.env.development` file is automatically used:
- Frontend will connect to `http://localhost:5000`
- Backend should be running on port 5000

To run locally:
```bash
# Terminal 1: Backend
cd workhub/backend
npm run dev

# Terminal 2: Frontend
cd workhub/frontend
npm run dev
```

### Production Build

The `.env.production` file is used during the build process:
- Ensures API calls go to the deployed backend
- WebSocket connections use the production server
- These values are baked into the Next.js build

## Backend (Render.com or Similar)

### Environment Variables to Set

On your backend deployment platform, set:

```
PORT=5000
MONGO_URI=memory
JWT_SECRET=your-secure-jwt-secret-key
CLIENT_URL=http://localhost:3000,http://localhost:3001,https://zettalogix-workos.netlify.app,https://*--zettalogix-workos.netlify.app
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o-mini
```

### CORS Configuration Explanation

- `CLIENT_URL` environment variable controls which frontend domains can access the backend
- Wildcards (e.g., `https://*--zettalogix-workos.netlify.app`) support Netlify preview deployments
- The backend automatically allows `localhost` origins for development

## Common Issues & Fixes

### Issue 1: CORS Errors
**Symptoms:** Browser console shows "CORS policy blocks requests"

**Solutions:**
1. Verify `CLIENT_URL` on backend includes your frontend domain
2. Check that `NEXT_PUBLIC_API_URL` in frontend matches backend URL
3. Ensure both frontend and backend are deployed (not mixing local + deployed)

### Issue 2: 404 Errors on API Calls
**Symptoms:** API requests return 404 errors

**Solutions:**
1. Verify `NEXT_PUBLIC_API_URL` ends with `/api`
2. Check backend is running on correct port
3. Ensure routes are properly defined in backend

### Issue 3: WebSocket Connection Fails
**Symptoms:** Real-time features don't work, Socket.IO errors in console

**Solutions:**
1. Verify `NEXT_PUBLIC_WS_URL` matches backend server URL (without `/api`)
2. Check backend WebSocket server is initialized
3. Ensure JWT token is available in localStorage

### Issue 4: 401 Unauthorized on Initial Load
**Symptoms:** User gets redirected to login on page load

**Solutions:**
1. Check localStorage has valid token (`workhub-token`)
2. Verify JWT_SECRET is consistent between deployments
3. Check token refresh endpoint is working: GET `/api/auth/me`

## Testing Connectivity

### Frontend Health Check
```bash
curl https://zettalogix-workos.netlify.app/
```

### Backend Health Check
```bash
curl https://zettalogix-workos.onrender.com/health
curl https://zettalogix-workos.onrender.com/api/health
```

### API Authentication Test
```bash
# 1. Login to get token
curl -X POST https://zettalogix-workos.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@workhub.local","password":"admin123"}'

# 2. Use token to verify connection
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://zettalogix-workos.onrender.com/api/auth/me
```

## Deployment Checklist

- [ ] Frontend environment variables set in Netlify dashboard
- [ ] Backend environment variables set on deployment platform
- [ ] Backend CORS includes frontend domain in CLIENT_URL
- [ ] Both services use HTTPS in production
- [ ] Database is properly initialized (using in-memory for demo)
- [ ] OpenAI API key is valid and has sufficient quota
- [ ] JWT secrets are consistent across all instances
- [ ] Health check endpoints return 200 status
- [ ] API endpoints respond without CORS errors
- [ ] WebSocket connections establish successfully
- [ ] User authentication flow works end-to-end

## Re-deployment Steps

After making configuration changes:

### Frontend (Netlify)
1. Update environment variables in Netlify dashboard
2. Clear build cache if needed
3. Trigger new deploy (push to main branch or manual deploy)
4. Verify build completes without errors

### Backend
1. Update environment variables on deployment platform
2. Restart the backend service
3. Verify service is running: check health endpoints

## Debugging Tips

### Check Browser Console
- Look for CORS errors: indicates frontend/backend URL mismatch
- Look for 401/403 errors: indicates authentication issue
- Look for "Failed to connect" WebSocket errors

### Check Backend Logs
- Look for "CORS policy blocks requests"
- Look for database connection errors
- Look for JWT verification failures

### Environment Variable Debug
Add this to frontend `.env.local` temporarily (remove before production):
```
# Temporary - for debugging only
NEXT_DEBUG_ENV_VARS=true
```

Then check the Network tab in browser DevTools to see actual API URLs being called.
