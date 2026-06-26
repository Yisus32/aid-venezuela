---
# AID-10: External Brand Icons (“X.com”, “TikTok”) in Servicios Tab

In the **Servicios** sidebar tab (`#tab-servicios`), display the favicon of `x.com` and `tiktok.com` as an avatar/icon for their respective entries in the list of external services.

## Instructions

- For service links to **X.com** or **TikTok.com** (e.g., live hashtag search links), display the site’s favicon as a leading icon (avatar) next to the entry.
- Fetch favicon directly from:
    - [`https://x.com/favicon.ico`](https://x.com/favicon.ico)
    - [`https://www.tiktok.com/favicon.ico`](https://www.tiktok.com/favicon.ico)
- Only apply to social brands (X, TikTok); other service links (custom crisis sites) do **not** get an avatar.
- Style for visual consistency (e.g. 1.5em, round or square; `vertical-align: middle;`).

## Example (Markdown/HTML for Astro/React/Markdown-supporting renderers):

```markdown
- <img src="https://x.com/favicon.ico" alt="X logo" width="24" height="24" style="vertical-align: middle; border-radius: 50%; margin-right: 0.5em;" /> [Hashtag en X](https://x.com/hashtag/venezuela)
- <img src="https://www.tiktok.com/favicon.ico" alt="TikTok logo" width="24" height="24" style="vertical-align: middle; border-radius: 50%; margin-right: 0.5em;" /> [Hashtag en TikTok](https://www.tiktok.com/tag/venezuela)
- [reportaven.com](https://reportaven.com)
- [redayudavenezuela.com](https://redayudavenezuela.com)
```

**Notes:**

- Use direct image `<img>` HTML for the icons within markdown lists.
- Adjust image size as needed to match site style.
- If favicon fails to load, let browser show fallback (no letters required).

## Acceptance Criteria

- [ ] “X.com” and “TikTok.com” links show their favicon as icon/avatar in the Servicios tab.
- [ ] All other service links are text only.

---