
---
# AID-12: Branding Footer in Sidebar

## Acceptance Criteria

- At the bottom of the sidebar, show:
    - The text: `Powered by Talos Software`
    - A clickable link with the URL: `www.talosware.com.ve` (links to `https://www.talosware.com.ve`, opens in new tab)
    - Add the favicon of Talos Software (from [talos/landing-page](https://github.com/talos/landing-page)):
        - Assuming standard favicon location, use `/branding/talos-favicon.ico` (place a copy in `public/branding/`)
    - Also display a favicon with the Venezuelan flag, for this page's own branding (e.g. `/branding/venezuela-flag.ico`, or use `/branding/venezuela-flag.svg` if a vector is available)
- Both favicons should be shown together, e.g. left-to-right: [Venezuela flag] [Talos favicon] `Powered by Talos Software` (as a link).

## Example Sidebar Footer (pseudo-HTML):

```html
<div class="sidebar-branding-footer">
  <a href="https://www.talosware.com.ve" target="_blank" rel="noopener">
    <img src="/branding/venezuela-flag.ico" alt="Venezuela Flag" style="height: 20px; vertical-align: middle; margin-right: 8px;" />
    <img src="/branding/talos-favicon.ico" alt="Talos Favicon" style="height: 20px; vertical-align: middle; margin-right: 8px;" />
    <span>Powered by Talos Software</span>
  </a>
</div>
```

> **Implementation Note:**  
> - Add `/branding/talos-favicon.ico` (from Talos landing-page repo) and a `/branding/venezuela-flag.ico` (common favicon or SVG for Venezuela) to the Astro `public/branding/` directory.
> - Style the branding block so that it sits flush at the bottom of the sidebar with appropriate spacing.
> - The entire block should act as a link to www.talosware.com.ve, opening in a new tab.

---

