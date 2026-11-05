#!/bin/bash
# Configure Google OAuth for Supabase project

# Load environment variables
source .env

PROJECT_ID="znhhavbeqxoydojywttu"
SUPABASE_URL="https://${PROJECT_ID}.supabase.co"

echo "Configuring Google OAuth for project: $PROJECT_ID"

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "Install Supabase CLI: npm install -g supabase"
    exit 1
fi

# Check for authentication
echo "Checking Supabase authentication..."
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "Error: SUPABASE_ACCESS_TOKEN not set"
    echo "Set it with: export SUPABASE_ACCESS_TOKEN=your_access_token"
    echo "Or run: supabase login"
    exit 1
fi

# Configure Google OAuth via CLI
echo "Configuring Google OAuth provider..."
supabase auth provider update google \
    --client-id="$GOOGLE_CLIENT_ID" \
    --client-secret="$GOOGLE_CLIENT_SECRET" \
    --project-ref="$PROJECT_ID"

echo "Done! Verify in Supabase Dashboard → Authentication → Providers → Google"

# Configure URL settings
echo ""
echo "Setting up URL configuration..."
echo "Add the following to Supabase → Authentication → Settings → URL Configuration:"
echo "  Site URL: https://your-vercel-app.vercel.app"
echo "  Redirect URLs:"
echo "    - https://your-vercel-app.vercel.app/auth/callback"
echo "    - http://localhost:5175/auth/callback"