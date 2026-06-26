AID-04

## AID-04: Social Channels Feed (X.com & TikTok Lives)

### Goal

Provide a real-time feed of X.com (Twitter) and TikTok Live videos **specifically related to the Venezuela earthquake**, allowing users to view relevant live coverage, updates, and discussions as they occur.

---

### Requirements

- **Sources:**  
  - X.com (Twitter): Search and display posts, threads, and live Spaces using Venezuela-earthquake-related hashtags (examples: `#SismoVenezuela`, `#TerremotoVenezuela`, `#AcopioVzla`, etc).
  - TikTok: Fetch and display TikTok Lives, short videos or livestreams tagged with similar hashtags or referencing the emergency in Venezuela.

- **Selection Criteria:**  
  - Filter/search content using:
    - Hashtags (as above, plus localized variations)
    - Text search for "Venezuela" and variants in Spanish (`sismo`, `terremoto`)
    - Comments/interactions mentioning aid, locations, acopios, damage, or personal requests.
    - Trending/engaged posts with >1 like, retweet, or comment (to filter spam and amplify relevance)

- **Feed Display:**  
  - Each platform’s feed presented in a visually distinct section.
  - Each feed item shows:
    - Main content (post/video preview, username/handle, timestamp)
    - Direct link to source (opens in new tab)
    - Contextual indicators (hashtags, likes, live indicator if applicable)
  - Display a loading indicator while fetching.
  - If content cannot be fetched, show a helpful fallback message.

- **Scraping/Fetching Triggers:**  
  - Feed data should be loaded:
    - On-demand (when user opens feed tab, reloads, or presses a "Reload" button)
    - Or, **auto-refresh every 2 hours** (background refresh, cache invalidate and refetch)
  - Scraping must obey platform rate limits and ToS; **prefer official APIs, but fallback to scraping if necessary** (document limitations and prefer user-initiated fetch for rate-heavy endpoints).

- **Privacy/Compliance:**  
  - Never store or persist third-party content beyond what’s required for rendering the feed in the current site session.
  - Clearly label sources, and only display public or embed-permitted media.

---

### Implementation Guidance

- **Backend (recommended):**
    - Provide an endpoint (e.g., `/api/social-feed`) that, on trigger, fetches recent X.com and TikTok content according to the above filters.
    - Cache last results for up to 2 hours under heavy use; allow "force reload" if user requests.
    - Use public or partner APIs where possible. For X.com: [X API v2 search endpoint](https://developer.x.com/en/docs/twitter-api/tweets/search/api-reference/get-tweets-search-recent) (filtered for relevant hashtags); for TikTok: search or scrape with headless browser or use available third-party APIs.
- **Frontend:**
    - UI component for "Social Feed" tab.
    - Show both feeds in parallel columns or stacked cards; display feedback (loading/failure); reload button if fetch fails or user wants latest.
    - Clearly indicate update time.
- **Security:**  
    - Sanitize all fetched content for XSS before rendering in static site context.
- **Extensibility:**  
    - Allow maintainers to easily add or refine hashtags/keywords.

---

### Example UI (Rough):

```
[ Social Feed ]
----------------------------
| [Reload] [Last updated: 13:02] |
----------------------------

[X.com]
- @user1: "Centro de acopio abierto #SismoVenezuela" [🔗]
- @user2: [LIVE SPACE] Mesa redonda terremoto (230 oyentes) [🔗]

[TikTok]
- @tiktokuser: [live video preview] #TerremotoVenezuela [🔗]
- ...

```

**N.B.**: Scraping TikTok and X.com is fragile and subject to API changes and access limitations; document any required secrets or credentials separately.

---