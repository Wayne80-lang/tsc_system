# TSC System Admin Dashboard - AJAX Debugging Guide

## Issues Fixed

### 1. ✅ UserRole Admin Dropdown Fields (FIXED)
**Problem:** Role-based dropdown field visibility stopped working - all dropsets showed regardless of role

**Root Cause:** JavaScript was searching for fieldsets by legend text, which wasn't reliable

**Solution:** Updated `access_request/static/admin/js/userrole_admin.js` to:
- Search fieldsets by their contained field names instead of legend text
- Added comprehensive console logging for debugging
- Added MutationObserver to catch programmatic role changes
- Identify fieldsets by:
  - `directorate` field → HOD directorate fieldset
  - `system_assigned` field → System Admin fieldset
  - `hod` field (without directorate) → Staff manager fieldset

**Testing:**
1. Go to Django Admin > Access Request > User Roles
2. Create/Edit a UserRole
3. Open browser console (F12)
4. Change the role dropdown
5. Observe console logs showing which fieldsets are shown/hidden
6. Only the relevant fieldset for that role should be visible

**Expected Behavior:**
- Role = "staff" → Shows "Staff Manager" field (hod)
- Role = "hod" → Shows "HOD Assignment" field (directorate)
- Role = "sys_admin" → Shows "System Admin Assignment" field (system_assigned)

---

### 2. ✅ AJAX Form Submission (IMPROVED)
**Problem:** Dashboard refreshes when making decisions on multi-system requests

**Root Cause:** AJAX wasn't intercepting form submissions

**Solutions Implemented:**

#### Solution A: Modern Fetch API (Primary)
- File: `templates/access_request/system_admin_dashboard.html`
- Function: `initializeFormHandlers()`
- Detects forms with action containing "/system-admin/"
- Intercepts submit, prevents default
- Sends FormData via Fetch with `X-Requested-With: XMLHttpRequest` header
- Django view detects this header and returns JSON
- On success: removes the system row, closes dropdown, shows notification
- On error: shows error notification, re-enables button

#### Solution B: Console Debugging
- Heavy console logging to track:
  - Form detection: `[Form ${idx}]` logs
  - Submit interception: "Submit prevented"
  - Fetch execution: "Fetching ${url}"
  - Response handling: "Success!" or error details

#### Solution C: Fallback Handler
- Function: `initializeFallbackHandler()` (optional)
- If AJAX fails, falls back to standard form submission
- Tracks failure via `window.ajaxFailed` flag

---

## Troubleshooting AJAX

### Step 1: Check Console Logs
1. Open browser console (F12)
2. Go to System Admin Dashboard
3. Open the pending requests dropdown
4. Watch for logs starting with `[Form`, `[AJAX`, etc.

**Expected logs:**
```
🔧 Initializing form handlers...
Found 2 decision forms
[Form 0] Adding submit listener
[Form 1] Adding submit listener
```

### Step 2: Try Making a Decision
1. Select "Grant Access" or "Reject" in dropdown
2. Check console for "Submit prevented" log
3. Should see "Fetching /access/system-admin/decision/{id}" log
4. Row should fade out and disappear without page refresh

### Step 3: If No Logs Appear
**Problem:** Forms not being detected

**Diagnostics:**
```javascript
// Run in console:
document.querySelectorAll('form[method="post"][action*="/system-admin/"]').length
```
Should return > 0

**Solution:**
- Forms might be inside collapsed sections
- Check form HTML directly in DevTools
- Verify `action` attribute contains "/system-admin/"

### Step 4: If Logs Show But Row Doesn't Disappear
**Problem:** Fetch succeeded but UI update failed

**Diagnostics:**
- Check "Response" in console logs
- Should show `{success: true, system_id: X, ...}`
- Verify row has `data-system-id` attribute matching response ID

### Step 5: If Error Occurs
**Problem:** Fetch failed or Django returned error

**Diagnostics:**
- Check Network tab (F12 > Network)
- Look for POST request to /system-admin/decision/
- Check response Status (should be 200 for success)
- Check response body (should be JSON)

**Common Errors:**
- `403 Forbidden`: User not logged in or wrong role
- `404 Not Found`: System ID doesn't exist
- `400 Bad Request`: Invalid action or missing fields
- `500 Server Error`: Django error (check server logs)

---

## Django View Support

### View: `system_admin_decision`
**Location:** `access_request/views.py:597`

**JSON Response Format:**
```python
{
    "success": True,
    "message": "Decision saved: ...",
    "system_id": 123,
    "status": "Granted",  # or "Rejected"
    "badge_class": "bg-success",  # or "bg-danger"
    "decision_date": "Nov 22, 2025 14:30"
}
```

**AJAX Detection:**
```python
if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
    return JsonResponse(...)
else:
    return redirect(...)
```

---

## Alternative: If AJAX Still Doesn't Work

### Option 1: Use HX-Boost (HTMX library)
Add to requirements.txt:
- No need - frontend only with JavaScript CDN

### Option 2: PJAX (Pushstate AJAX)
Similar to AJAX but handles browser history

### Option 3: Simple Page Redirect with Anchor
Instead of AJAX, redirect back to dashboard with URL anchor:
```python
# After decision, stay on same tab and scroll to request
return redirect(f'/access/system-admin/dashboard/?tab=pending#{request_id}')
```

### Option 4: WebSocket Updates (Advanced)
Real-time updates using Django Channels
- More complex but provides live feedback
- Eliminates page refresh entirely

---

## Testing Checklist

- [ ] Admin dropdown fields work correctly (check console for field detection logs)
- [ ] Form submit is intercepted (see "Submit prevented" in console)
- [ ] AJAX request is sent (check Network tab)
- [ ] Row disappears after decision (fade out animation)
- [ ] Success notification appears
- [ ] Dropdown closes automatically
- [ ] Second decision on different system works
- [ ] Error handling works (try reject without comment)
- [ ] Page doesn't refresh during any operation

---

## Key Files Modified

1. **`access_request/static/admin/js/userrole_admin.js`**
   - UserRole dropdown field visibility logic
   - Console logging for debugging

2. **`access_request/templates/access_request/system_admin_dashboard.html`**
   - `initializeFormHandlers()` - AJAX form submission
   - `initializeFallbackHandler()` - Fallback mechanism
   - `showNotification()` - Toast notifications
   - DOMContentLoaded event setup

3. **`access_request/views.py` (no changes needed)**
   - Already supports AJAX via X-Requested-With header
   - Returns JSON on AJAX requests

---

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ❌ IE 11 (Fetch API not supported - would need polyfill)

---

## Next Steps

1. **Test in browser:** Open admin and system admin dashboard
2. **Monitor console:** Watch for logs during operations
3. **Check Network:** Verify AJAX requests and responses
4. **Verify UI:** Ensure rows disappear without refresh
5. **Report issues:** If AJAX still fails, attach console logs

## Need Help?

1. Check console logs first
2. Verify Network tab shows AJAX request
3. Check Django server logs for errors
4. Verify `X-Requested-With` header is being sent
5. Check response is valid JSON
