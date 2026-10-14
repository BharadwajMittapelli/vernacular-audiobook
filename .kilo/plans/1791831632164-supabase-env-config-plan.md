# Supabase Project Setup and Environment Configuration Plan

## Context
- Supabase project "vernacualr-audiobook" already exists (ID: sgpkxgwnxusjagjnesir)
- Project is ACTIVE_HEALTHY in ap-northeast-1 region
- Current .env files exist in client/ and server/ directories with placeholder values
- Need to update .env files with actual Supabase credentials

## Objectives
1. Retrieve all required Supabase credentials from existing project
2. Update .env files with actual values (client and server)
3. Ensure consistent configuration across development environment

## Required Credentials
- SUPABASE_URL: https://sgpkxgwnxusjagjnesir.supabase.co (from project details)
- SUPABASE_ANON_KEY: Retrieved from project API keys (already obtained)
- SUPABASE_SERVICE_ROLE_KEY: Must be retrieved from Supabase dashboard > Project Settings > API

## Implementation Steps

### Step 1: Obtain Service Role Key
- Access Supabase dashboard for project vernacualr-audiobook
- Navigate to Settings > API > Service Role Key section
- Copy the service role secret key
- Store in secure environment variable retrieval system

### Step 2: Update Server .env
- Replace placeholder SUPABASE_URL with actual project URL
- Replace placeholder SUPABASE_SERVICE_ROLE_KEY with actual service role key
- Add SUPABASE_ANON_KEY for client-side access
- Maintain existing server configuration (PORT, GNANI_API_KEY_ID, etc.)

### Step 3: Update Client .env
- Add SUPABASE_URL for Vite configuration
- Add SUPABASE_ANON_KEY for client-side Supabase client initialization
- Preserve existing VITE_API_URL if needed for other services

### Step 4: Validation
- Verify .env files contain correct credentials
- Test Supabase connection in development environment
- Ensure no secrets are exposed in version control

## Dependencies
- Service role key from Supabase dashboard (manual step)
- Existing project access permissions

## Risks
- Service role key is sensitive - must not be committed to git
- Ensure .env files are added to .gitignore if not already
- Client and server environments must use same project reference

## Rollback Plan
- Revert .env files to placeholder values if credentials cause issues
- Clear any cached Supabase client instances

## Success Criteria
- All .env files contain valid Supabase credentials
- Supabase client initializes successfully in both client and server contexts
- No placeholder values remain in environment configuration