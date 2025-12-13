# PWA Testing Guide

## How to Test PWA Functionality

### Desktop Testing (Chrome/Edge)

1. **Open DevTools**
   - Press F12 or right-click and select "Inspect"
   
2. **Check Application Tab**
   - Navigate to Application → Manifest
   - Verify manifest details are loaded correctly
   - Check icons are properly configured
   
3. **Check Service Worker**
   - Navigate to Application → Service Workers
   - Verify service worker is registered and running
   - Status should show "activated and running"
   
4. **Test Install Prompt**
   - Look for install icon in address bar (desktop Chrome/Edge)
   - Click to install the PWA
   - App should open in standalone window
   
5. **Test Offline Mode**
   - In DevTools, go to Network tab
   - Check "Offline" checkbox
   - Refresh the page - app should still load from cache

### Mobile Testing (Android)

1. **Chrome on Android**
   - Open the app in Chrome
   - Look for "Add to Home Screen" banner or prompt
   - Tap menu (three dots) → "Install app" or "Add to Home Screen"
   - App icon appears on home screen
   - Launch app - should run in standalone mode (no browser UI)

2. **Verify Standalone Mode**
   - App should launch without address bar
   - No browser chrome visible
   - Full screen experience

### Mobile Testing (iOS)

1. **Safari on iOS**
   - Open the app in Safari
   - Tap Share button (square with arrow pointing up)
   - Scroll down and tap "Add to Home Screen"
   - Edit name if desired, tap "Add"
   - App icon appears on home screen

2. **Launch Installed App**
   - Tap icon from home screen
   - Should open in standalone mode
   - Status bar should match theme color

### Expected PWA Features

✅ **Manifest**
- Name: CardCade - Customer Card Manager
- Short name: CardCade
- Theme color: #1976d2 (Material Blue)
- Display: standalone
- Orientation: portrait-primary

✅ **Icons**
- 192x192 (any and maskable)
- 512x512 (any and maskable)
- 180x180 (Apple touch icon)

✅ **Service Worker**
- Auto-updating
- Caches all static assets
- Runtime caching for Google Fonts
- Offline support for cached content

✅ **iOS Support**
- Apple mobile web app capable
- Apple mobile web app title
- Apple touch icon
- Status bar style

### Verification Checklist

- [ ] Manifest loads without errors
- [ ] All icons display correctly
- [ ] Service worker registers successfully
- [ ] App can be installed (install prompt appears)
- [ ] Installed app launches in standalone mode
- [ ] Theme color applies correctly
- [ ] App works offline after first visit
- [ ] Icons appear correctly on home screen
- [ ] App name displays correctly when installed

### Lighthouse PWA Audit

Run Lighthouse audit to verify PWA quality:

1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Select "Progressive Web App" category
4. Click "Analyze page load"
5. Review PWA score and recommendations

Expected scores:
- Progressive Web App: 90+
- Should pass all core PWA criteria

### Common Issues

**Service Worker Not Registering**
- Check console for errors
- Ensure HTTPS is used (required for service workers)
- Clear browser cache and reload

**Install Prompt Not Showing**
- PWA criteria must be met (manifest, service worker, HTTPS)
- Some browsers delay showing prompt
- Can still install via browser menu

**Icons Not Showing**
- Verify icon files exist in public/ directory
- Check paths in manifest are correct
- Clear cache and rebuild

**Offline Mode Not Working**
- Service worker must be activated first
- Visit pages while online to cache them
- Check service worker caching strategy in DevTools
