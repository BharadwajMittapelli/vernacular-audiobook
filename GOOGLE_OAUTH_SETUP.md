# Google OAuth Configuration for Supabase

## Project ID
**znhhavbeqxoydojywttu**

## Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services → Credentials**
3. Create or select OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Authorized redirect URIs:
     ```
     https://znhhavbeqxoydojywttu.supabase.co/auth/v1/callback
     http://localhost:5175/auth/callback
     ```
4. Save:
   - **Client ID** → `GOOGLE_CLIENT_ID`
   - **Client Secret** → `GOOGLE_CLIENT_SECRET`

## Step 2: Configure in Supabase Dashboard

### Via Supabase CLI (Authenticated)
```bash
# Login first
supabase login

# Configure Google provider
supabase auth provider update google \
  --client-id YOUR_CLIENT_ID \
  --client-secret YOUR_CLIENT_SECRET
```

### Via Supabase Dashboard (Manual)
1. Go to **Supabase Dashboard → znhhavbeqxoydojywttu → Authentication → Settings**
2. Under **URL Configuration**:
   - Site URL: `https://your-vercel-app.vercel.app`
   - Redirect URLs:
     - `https://your-vercel-app.vercel.app/auth/callback`
     - `http://localhost:5175/auth/callback`
3. Under **Providers → Google**:
   - Enable Google provider
   - Enter Client ID and Client Secret
   - Save

## Step 3: Update Environment Variables

### Server (.env) - if needed
```bash
# Usually handled automatically by Supabase, but can be added:
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## Step 4: Verify OAuth Flow

1. Local development:
   - Run `npm run dev`
   - Visit `http://localhost:5175/login`
   - Click "Sign in with Google"
   - Should redirect to Google and back to `/home`

2. Production (after Vercel deployment):
   - Deploy frontend to Vercel
   - Test OAuth from the deployed URL

## Common Issues

### Issue: "Invalid redirect URI"
- Check redirect URLs in Google Cloud Console match exactly
- Ensure no trailing slashes

### Issue: "OAuth callback failed"
- Verify `SITE_URL` in Supabase Auth Settings matches your Vercel URL
- Check browser console for CORS errors

### Issue: "Provider not enabled"
- Confirm Google provider is toggled ON in Supabase Dashboard