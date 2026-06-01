# debug-snode

## Description
Systematic debugging workflow for the Snode-rpg project. Covers static analysis patterns, Playwright live-site testing, common root causes (selector mismatches, caching, sync gaps between source and electron-app mirror), and verification checklists.

## When to Use
- User reports a bug in any page of the Snode-rpg project
- User asks to "debug", "fix", "check", "test", or "verify" something
- Any change is made and needs verification on the live site
- User mentions something "doesn't work" or "is broken"

## Project-Specific Gotchas (READ FIRST)

These are the most common root causes of bugs in this project. Always check these BEFORE deep-diving:

### 1. DOM Selector Mismatch Between Render & Logic Layers
**Pattern**: HTML is rendered with one class/selector, but the JS logic queries with a different one.
**Classic case**: `_applyHighlights` queries `.skill` but global search results use `.search-result-item`.
**Check**: For any JS function that queries the DOM, verify the selector matches the actual rendered HTML.

### 2. electron-app Mirror Out of Sync
**Pattern**: Root `职业页/` and `electron-app/职业页/` are independent copies. If you modify one, you MUST sync the other.
**Check**: `diff 职业页/xxx.html electron-app/职业页/xxx.html`
**Rule**: Root is source of truth. During packaging, electron-app gets overwritten FROM root.

### 3. Cloudflare Pages CDN Caching
**Pattern**: After pushing to GitHub, the deployed site may serve stale content for several seconds/minutes.
**Fix**: Add `?v=timestamp` query param, or use Playwright with hard-reload bypass.

### 4. `_applyHighlights` / `_clearHighlights` Scope
These functions in `common.js` are designed for individual class skill pages (`.skill` elements). They will NOT work on pages or components with different DOM structures. If you're creating a new UI component, either:
- Use the `.skill` class convention, OR
- Implement your own highlighting logic (inline regex in HTML generation is recommended)

### 5. JS Scope Isolation (IIFE)
All per-page scripts should be wrapped in IIFE `(function() { ... })()`. Variable naming must use unique prefixes per class to avoid collision when multiple class views coexist in the same page.

## Debug Workflow

### Phase 1: Reproduce (ALWAYS FIRST)

**Goal**: Confirm the bug exists on the live site and capture exact behavior.

```
1. Navigate to snode-rpg.pages.dev/职业页/首页.html (or relevant page)
2. Use Playwright to interact: browser_navigate → browser_click → browser_type
3. Use browser_evaluate to extract key metrics (element counts, class presence, etc.)
4. Document: what happens vs. what should happen
```

**Key Playwright evaluation snippets:**

```javascript
// Check if elements exist
() => ({
  elementExists: !!document.getElementById('target-id'),
  elementClasses: document.getElementById('target-id').className
})

// Count search highlights
() => ({
  highlights: document.querySelectorAll('.search-highlight').length,
  results: document.querySelectorAll('.search-result-item').length
})

// Verify selector match
() => ({
  skillElements: document.querySelectorAll('#container .skill').length,
  resultElements: document.querySelectorAll('#container .search-result-item').length
})
```

### Phase 2: Trace to Root Cause

**Goal**: Walk backward from the symptom to the exact line of code that fails.

1. **Read the relevant source files** — don't guess
2. **Trace function call chains** — use grep/read to follow the code path
3. **Check selector consistency** — for every `querySelector`, verify the selector matches the actual HTML
4. **Check conditional branches** — is the failing code even being reached?

### Phase 3: Fix

**Principles**:
- **Minimal change** — fix only what's broken, don't refactor adjacent code
- **Match existing patterns** — use the same coding style as the surrounding code
- **Don't suppress** — never use `try/catch` to swallow errors, never use type coercion hacks
- **String-level operations preferred** — for dynamically generated HTML, do formatting (highlights, etc.) during HTML string generation, not via post-render DOM manipulation

### Phase 4: Verify

**Required verification on pages.dev:**

```
1. browser_navigate to the affected page (with ?v=n cache buster)
2. Reproduce the original bug scenario → confirm it's FIXED
3. Test at least 2 edge cases (empty input, special characters, multiple terms)
4. Check console: browser_console_messages(level="error") — must be empty
5. If navigable: click a result link → confirm destination is correct
```

### Phase 5: Sync & Deploy

```
1. Check if electron-app has corresponding files → sync if needed
2. git add + commit (descriptive message)
3. git push origin master
4. Wait for Cloudflare Pages deployment (~1-3 min)
5. Re-verify on pages.dev with cache buster
```

## Common Debug Scenarios

### Scenario A: "X doesn't work" (generic)

```
1. Open the relevant page on pages.dev
2. Use browser_evaluate to check if the JS function/variable exists in global scope
3. Check browser_console_messages for errors
4. Trace the function chain from entry point to failure point
```

### Scenario B: "Search/filter doesn't highlight"

```
1. Check if _applyHighlights is being called
2. Check what selector it uses
3. browser_evaluate: count elements matching that selector in the target container
4. If count = 0 → selector mismatch (Gotcha #1)
```

### Scenario C: "Works locally but not on pages.dev"

```
1. Check if the file was pushed to GitHub (git log -1 --stat)
2. Check Cloudflare deployment status
3. Test with ?v=cachebuster param
4. Check if electron-app mirror was also updated (could be confusion between versions)
```

### Scenario D: "Button/UI element not visible"

```
1. browser_evaluate: check getBoundingClientRect(), display, visibility, opacity, zIndex
2. Check if position:fixed elements have offsetParent = null (normal, not a bug)
3. Check for CSS .hidden or .filter-hidden classes
4. Check viewport vs element position (is it scrolled off-screen?)
```

## File Map for Debugging

| Bug Surface | Primary Files to Check |
|-------------|----------------------|
| 首页 global search | `职业页/首页.html` (self-contained), `职业页/common.css` |
| Class skill search | `职业页/{class}.html`, `职业页/filter.js` |
| Search highlights | `职业页/common.js` (_applyHighlights / _clearHighlights) |
| Keyword filter chips | `职业页/filter.js` (FilterController), `职业页/{class}.html` |
| Navigation sidebar | `职业页/{class}.html`, `职业页/common.css` (nav, .style-link) |
| Cost dot colors | `职业页/{class}.html` (inline style), `职业页/数据/{class}.json` |
| Mobile drawer nav | `职业页/common.css` (.nav-toggle, .nav-drawer), `职业页/{class}.html` |
| Character panel | `斯诺德跑团/角色面板.html`, `斯诺德跑团/panel_engine.js`, `斯诺德跑团/panel_data.js` |
| Launcher | `斯诺德跑团/启动台.html` |
| Help docs | `斯诺德跑团/帮助.html` |

## Verification Checklist (per fix)

```
[ ] Console error-free (browser_console_messages level=error)
[ ] Original bug scenario → FIXED
[ ] Edge case 1: empty/null input handled gracefully
[ ] Edge case 2: maximum data scenario (many results)
[ ] Navigation/links still work (if modified UI has links)
[ ] electron-app mirror synced (if modifying files under 职业页/ or 斯诺德跑团/)
[ ] Git pushed + pages.dev deployed
[ ] Live site verified with cache buster
```

## Playwright Quick Reference

```javascript
// Navigate
browser_navigate(url="https://snode-rpg.pages.dev/职业页/首页.html")

// Click
browser_click(target="#searchFloatBtn", button="left")

// Type
browser_type(target="#searchWidgetInput", text="猛击", slowly=true)

// Evaluate (inspect state)
browser_evaluate(function='() => ({ highlights: document.querySelectorAll(".search-highlight").length })')

// Wait
browser_wait_for(time=0.5)

// Console
browser_console_messages(level="error")

// Key press
browser_press_key(key="Escape")
```
