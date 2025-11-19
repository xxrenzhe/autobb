# Authentication Cookie Migration - Complete

**Date**: 2025-11-19
**Status**: ✅ Complete
**Impact**: Critical authentication architecture fix

## Problem Summary

The application had an **authentication architecture mismatch**:
- Login API correctly set HttpOnly cookies (`auth_token`)
- But some API routes were trying to read from Authorization headers instead of cookies
- This caused 401 Unauthorized errors after successful login

## Root Cause

Cookie-based authentication flow vs header-based authentication expectations:

```
❌ WRONG PATTERN:
1. Login → Sets cookie
2. Browser → Sends cookie automatically
3. API route → Tries to read Authorization header ← FAIL!

✅ CORRECT PATTERN:
1. Login → Sets cookie
2. Browser → Sends cookie automatically
3. API route → Reads from cookie ← SUCCESS!
```

## Files Modified

### 1. `/src/app/api/auth/me/route.ts`
**Issue**: Dashboard calls this endpoint after login, but it was reading Authorization header

**Before**:
```typescript
const authHeader = request.headers.get('authorization')
const token = extractTokenFromHeader(authHeader)
```

**After**:
```typescript
const token = request.cookies.get('auth_token')?.value
```

### 2. `/src/app/api/user/password/route.ts`
**Issue**: Password change endpoint expected Authorization header

**Fix**: Changed to read from cookie (same pattern as above)

### 3. `/src/app/api/auth/change-password/route.ts`
**Issue**: Another password change endpoint with same issue

**Fix**: Changed to read from cookie (same pattern as above)

## Verification Results

### Search for Authorization Header Usage
```bash
grep -r "request.headers.get('authorization')" src/app/api
```

**Results**: Only 2 files found - both are cron jobs (✅ CORRECT)
- `/api/cron/daily-link-check/route.ts` - Uses CRON_SECRET
- `/api/cron/weekly-optimization/route.ts` - Uses CRON_SECRET

### Search for extractTokenFromHeader Usage
```bash
grep -r "extractTokenFromHeader" src
```

**Results**: 6 files found
- ✅ `/api/auth/me/route.ts` - Fixed (now uses cookie)
- ✅ `/api/user/password/route.ts` - Fixed (now uses cookie)
- ✅ `/api/auth/change-password/route.ts` - Fixed (now uses cookie)
- ✅ `/lib/jwt.ts` - Function definition (not actual usage)
- ✅ `/lib/auth.ts` - Import only (not used for API auth)
- ⚠️ `/middleware.ts` - Function defined but NOT used (leftover code)

## Authentication Architecture

### Complete Flow

```
┌─────────────┐
│   Login     │
│ /api/auth/  │
│   login     │
└──────┬──────┘
       │
       │ Sets HttpOnly cookie
       ▼
┌─────────────────────────────┐
│   Browser (Cookie Store)    │
│   auth_token=<JWT>          │
└──────┬──────────────────────┘
       │
       │ Automatic cookie sending
       ▼
┌─────────────────────────────┐
│   Middleware                │
│   /src/middleware.ts        │
├─────────────────────────────┤
│ 1. Read cookie:             │
│    request.cookies.get()    │
│ 2. Verify JWT token         │
│ 3. Inject headers:          │
│    - x-user-id              │
│    - x-user-email           │
│    - x-user-role            │
│    - x-user-package         │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│   Protected API Routes      │
│   (Most /api/* routes)      │
├─────────────────────────────┤
│ Read from injected headers: │
│   request.headers.get(      │
│     'x-user-id'            │
│   )                         │
└─────────────────────────────┘

┌─────────────────────────────┐
│   Direct Auth Routes        │
│   (e.g., /api/auth/me)      │
├─────────────────────────────┤
│ Read directly from cookie:  │
│   request.cookies.get(      │
│     'auth_token'           │
│   )                         │
└─────────────────────────────┘
```

### Three Authentication Patterns

#### Pattern 1: Routes Behind Middleware (Most Common)
**Use Case**: Most protected API routes
**Example**: `/api/offers`, `/api/campaigns`, `/api/settings`

```typescript
export async function GET(request: NextRequest) {
  // Middleware already verified auth and injected headers
  const userId = request.headers.get('x-user-id')
  const userEmail = request.headers.get('x-user-email')
  const userRole = request.headers.get('x-user-role')

  // Use user info directly
  const data = await fetchUserData(userId)
  return NextResponse.json(data)
}
```

**✅ Correct**: No manual authentication needed
**❌ Wrong**: Don't read from cookie or Authorization header

#### Pattern 2: Direct Cookie Auth Routes
**Use Case**: Routes that need auth but aren't protected by middleware
**Example**: `/api/auth/me`, `/api/user/password`

```typescript
export async function GET(request: NextRequest) {
  // Read token from HttpOnly cookie
  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    return NextResponse.json(
      { error: '未提供认证token，请先登录' },
      { status: 401 }
    )
  }

  // Verify token
  const payload = verifyToken(token)
  if (!payload) {
    return NextResponse.json(
      { error: 'Token无效或已过期' },
      { status: 401 }
    )
  }

  // Use payload data
  const user = findUserById(payload.userId)
  return NextResponse.json({ user })
}
```

**✅ Correct**: Read from `request.cookies.get('auth_token')`
**❌ Wrong**: Don't read from Authorization header

#### Pattern 3: Service Auth (Cron Jobs)
**Use Case**: Scheduled tasks, internal services
**Example**: `/api/cron/daily-link-check`

```typescript
export async function POST(request: NextRequest) {
  // Read from Authorization header
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Execute cron job
  await performScheduledTask()
  return NextResponse.json({ success: true })
}
```

**✅ Correct**: Use Authorization header with CRON_SECRET
**❌ Wrong**: Don't use for user authentication

## Frontend Requirements

All frontend fetch calls to protected APIs must include:

```typescript
const response = await fetch('/api/protected-endpoint', {
  credentials: 'include'  // ← CRITICAL: Send cookies
})
```

**Status**: ✅ Already completed in previous session (45+ files updated)

## Migration Checklist

- [x] Identify all routes using Authorization header
- [x] Fix `/api/auth/me` to use cookie
- [x] Fix `/api/user/password` to use cookie
- [x] Fix `/api/auth/change-password` to use cookie
- [x] Verify cron routes correctly use Authorization
- [x] Verify middleware correctly reads from cookie
- [x] Confirm all frontend calls use `credentials: 'include'`
- [x] Test login flow end-to-end
- [x] Document authentication patterns

## Testing Results

### Manual Testing
```bash
# 1. Database initialized
✅ npx tsx scripts/init-database.ts

# 2. Admin user created
✅ npx tsx scripts/create-admin-user.ts

# 3. Test login via CLI
✅ npx tsx scripts/test-admin-login.ts

# 4. Test login via browser
✅ Login successful
✅ Dashboard loads correctly
✅ /api/auth/me returns user data
```

### Dev Server Status
```bash
✅ Server running at http://localhost:3000
✅ No authentication errors in logs
✅ Cookie-based auth working correctly
```

## Security Benefits

### HttpOnly Cookies (Current Implementation)
✅ **XSS Protection**: JavaScript cannot access auth tokens
✅ **CSRF Protection**: Combined with SameSite=Lax
✅ **Automatic Sending**: Browser handles cookie transmission
✅ **Secure Flag**: In production, cookies only sent over HTTPS

### vs Authorization Headers (Previous Incorrect Pattern)
❌ **XSS Vulnerable**: If token stored in localStorage/sessionStorage
❌ **Manual Management**: Frontend must manually attach to every request
❌ **No Built-in Protection**: Relies entirely on application code

## Future Guidelines

### Adding New Protected Routes

1. **If route is in `/api/` and needs user auth**:
   - Add path prefix to `protectedPaths` array in `middleware.ts`
   - Route will automatically get `x-user-*` headers
   - Read user info from headers (Pattern 1)

2. **If route needs direct cookie access**:
   - Use Pattern 2: `request.cookies.get('auth_token')?.value`
   - Verify token with `verifyToken()`
   - Extract user info from payload

3. **If route is for cron/service**:
   - Use Pattern 3: Authorization header with CRON_SECRET
   - **Never** use this for user authentication

### Code Review Checklist

- [ ] Does new API route read from Authorization header?
  - If YES for user auth → ❌ REJECT - Use cookie instead
  - If YES for cron → ✅ OK - Ensure CRON_SECRET used

- [ ] Does frontend fetch call include `credentials: 'include'`?
  - If NO → ❌ REJECT - Cookies won't be sent

- [ ] Is route protected by middleware?
  - If YES → Use `x-user-*` headers (Pattern 1)
  - If NO → Use cookie directly (Pattern 2)

## Cleanup Opportunities

### Leftover Code
The `extractTokenFromHeader` function in `middleware.ts` (lines 13-20) is defined but never called. It can be safely removed in a future cleanup task.

## Success Metrics

- ✅ 0 user-facing routes using Authorization header
- ✅ 100% of protected routes using cookie or middleware headers
- ✅ Login flow works end-to-end
- ✅ No 401 errors on dashboard after login
- ✅ All authentication patterns documented

## Related Documentation

- Previous session: Frontend credentials migration (45+ files)
- Database initialization: `scripts/init-database.ts`
- Admin user creation: `scripts/create-admin-user.ts`
- Middleware configuration: `src/middleware.ts`
