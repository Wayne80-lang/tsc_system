# AJAX Fix - Testing Guide

## What Was Fixed

1. **Simplified Form Detection** - Now detects forms by exact URL match `/system-admin/decision/`
2. **Prevented Double Listeners** - Uses `form.dataset.ajaxAttached` to prevent adding multiple listeners
3. **Removed Form Cloning** - No longer breaks CSRF tokens by cloning forms
4. **Added MutationObserver** - Detects when forms are dynamically added/shown
5. **Better Console Logging** - Detailed logs at every step for debugging

## How to Test

### Step 1: Open Browser DevTools
1. Press `F12` to open Developer Tools
2. Click the **Console** tab
3. Keep it visible while testing

### Step 2: Navigate to System Admin Dashboard
```
http://localhost:8000/access/system-admin/dashboard/
```

### Step 3: Watch Console on Page Load
You should see:
```
🎯 [DOMContentLoaded] Page loaded
📢 [INIT] Starting form handler initialization
📊 [INIT] Total forms on page: X
   Form X: action="..."
✅ [FORM-1] System admin form detected
✅ [INIT] Attached handlers to 1 decision forms
👁️ [OBSERVER] MutationObserver active
```

### Step 4: Expand a Pending Request (Click the + button)
The request details should expand showing systems

### Step 5: Click "Action" Dropdown on a System
The dropdown menu should appear with Decision and Reason fields

### Step 6: Make a Decision
1. Select "Grant Access" or "Reject"
2. If "Reject", add a reason
3. Click "Confirm"

### Step 7: Watch Console for Logs
You should see:
```
🔵 [SUBMIT] Form submitted
   Action: approve, Comment: "", URL: /access/system-admin/decision/123/?...
📤 [FETCH] Sending to: /access/system-admin/decision/123/?...
📥 [RESPONSE] Status: 200
✨ [SUCCESS] Response: {success: true, system_id: 123, ...}
✅ [INIT] Attached handlers to 1 decision forms
🗑️ [ROW] Removing row for system 123
```

### Step 8: Verify No Page Refresh
- ❌ Page should NOT refresh
- ✅ Row should fade out and disappear
- ✅ Success notification should appear
- ✅ Dropdown should close
- ✅ You should stay on the same tab

## If It Still Doesn't Work

### Check: Are forms being detected?
In console, run:
```javascript
document.querySelectorAll('form[action*="/system-admin/decision/"]').length
```
Should return > 0

### Check: Are listeners attached?
```javascript
document.querySelectorAll('form[data-ajax-attached="true"]').length
```
Should match the number of forms found

### Check: Network tab
1. Open DevTools Network tab
2. Make a decision
3. Look for POST request to `/access/system-admin/decision/...`
4. Click it and check:
   - Status: 200
   - Response: Valid JSON with `{success: true, ...}`

### Check: View Page Source
Right-click page → "View Page Source"
Search for `<form method="post" action="/access/system-admin/decision/`
Verify the form exists in HTML

## Troubleshooting

### Issue: Forms not detected (0 found)
**Solution:** Check if forms are inside collapsed sections
- They should be rendered initially, not dynamically
- MutationObserver should catch them if added later

### Issue: Submit button doesn't show loading state
**Solution:** Check form structure
- Verify button has `type="submit"`
- Verify button is inside the form

### Issue: Page still refreshes
**Solution:** Check if CSRF token is being sent
- FormData automatically includes CSRF token
- Should not need manual header

### Issue: Response is not JSON
**Solution:** Check Django view returns JSON for AJAX
- View should check: `if request.headers.get('X-Requested-With') == 'XMLHttpRequest'`
- Then return JsonResponse

## Rollback If Needed

If AJAX still causes issues, temporarily allow standard form submission:
1. Comment out `event.preventDefault();` in handleSystemAdminDecision()
2. Forms will submit normally with page refresh
3. At least the decision will be saved

## File Locations

- **JavaScript Handler:** `templates/access_request/system_admin_dashboard.html` lines ~280-370
- **Django View:** `access_request/views.py` line 597 (system_admin_decision)
- **Admin JS:** `static/admin/js/userrole_admin.js` (for dropdown fields)

## Console Log Reference

| Log | Meaning |
|-----|---------|
| 🎯 [DOMContentLoaded] | Page fully loaded |
| 📢 [INIT] | Starting form detection |
| 📊 [INIT] Total forms | How many forms exist on page |
| ✅ [FORM-X] | System admin form found |
| 👁️ [OBSERVER] | Mutation watcher is active |
| 🔵 [SUBMIT] | Form submission intercepted |
| 📤 [FETCH] | AJAX request being sent |
| 📥 [RESPONSE] | Server responded |
| ✨ [SUCCESS] | Operation succeeded |
| 🗑️ [ROW] | Removing row from table |
| ⚠️ | Warning/error condition |
| ❌ | Error occurred |

## Contact

If AJAX is still not working after these fixes, provide:
1. Browser console screenshot (F12)
2. Network tab screenshot showing the POST request
3. Django server logs (from terminal where runserver is running)
