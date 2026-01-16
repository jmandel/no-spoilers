# Mystery Hunt Spoiler Hider

A Chrome extension to hide spoilers on MIT Mystery Hunt puzzle pages. Configurable domains and CSS selectors, with per-element reveal buttons.

## Quick Install (Chrome)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select this folder (`mystery-hunt-spoiler-hider`)
5. The extension icon should appear in your toolbar

## Usage

### Configure Domains

Click the extension icon and add the domains where you want spoiler hiding to be active:

- `puzzles.mit.edu` - exact domain match
- `*.example.com` - wildcard matches subdomains

### Configure Selectors

Add CSS selectors for elements you want hidden:

- `.answer` - elements with class "answer"
- `#solution` - element with id "solution"
- `[data-solved="true"]` - elements with data attribute
- `.puzzle-status.solved` - compound selectors
- `.spoiler, .answer, .solution` - multiple selectors (add separately)

### Revealing Spoilers

Each hidden element shows a **"👁 Reveal Spoiler"** button. Click it to see that specific element.

You can also use the popup buttons:
- **Reveal All** - show all hidden elements on the page
- **Re-hide All** - re-hide elements matching your selectors

### Live Updates

The extension:
- Watches for dynamically loaded content (SPA navigation)
- Applies immediately when you add/remove selectors
- Works across page refreshes

## Sharing with Teammates

Option 1: **Share the folder**
- Zip this folder and share with teammates
- They install following the same steps above

Option 2: **Sync config only**
- After installing, export your config from DevTools console:
  ```js
  chrome.storage.local.get(null, c => console.log(JSON.stringify(c, null, 2)))
  ```
- Share the JSON, teammates import:
  ```js
  chrome.storage.local.set({domains: [...], selectors: [...]})
  ```

## Example Selectors for Mystery Hunt

Common patterns (adjust based on actual site):

```
.answer
.solution
.solved
[data-solved]
.puzzle-answer
.hint-text
.spoiler
```

## Troubleshooting

**Extension not working?**
- Make sure the current domain is in your domains list
- Check that "Domain Match" shows "Yes ✓" in the popup
- Refresh the page after adding domains

**Selectors not matching?**
- Use browser DevTools to test selectors: `document.querySelectorAll('.your-selector')`
- Check for typos in class/id names

**Content script errors?**
- Open DevTools (F12) and check the Console for errors
- Some pages may have strict CSP that blocks extensions

## Files

```
manifest.json    - Extension configuration
content.js       - Runs on pages, hides elements
content.css      - Styles for overlays
popup.html/js    - Configuration UI
background.js    - Service worker
icons/           - Extension icons
```
