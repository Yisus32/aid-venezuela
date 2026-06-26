AID-06

## AID-06: "How to Get There" Feature Specification

### Requirement

For **every address shown on the `/acopio` page**, provide a direct hyperlink that opens Google Maps in a new browser tab, pre-filled with *"How to get there"* navigation to that precise location.

- The address text (e.g., `"Plaza de Puerto Principe, Lecheria, Anzoategui"`) must be clickable.
- Clicking the address opens a Google Maps link with the address as the destination, using `https://www.google.com/maps/dir/?api=1&destination=...`.
- The link MUST use `target="_blank"` and `rel="noopener noreferrer"` to ensure it opens in a new tab securely.
- The original address text remains visible as the link text.
- If the user's current location is available (via browser geolocation), navigation should route from the user to the destination; otherwise, just show the destination route page.

### UI Implementation Sketch

Wherever an address is rendered in the `/acopio` list or detail card:

```tsx
// Example—in your component that renders each aid center:
<a
  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
  target="_blank"
  rel="noopener noreferrer"
>
  {address}
</a>
```
- Replace `address` with the actual address string for each item.

### Acceptance Criteria

- [ ] All addresses on the `/acopio` page are hyperlinks as described.
- [ ] Clicking any address immediately opens a new tab with a Google Maps route to that location.
- [ ] No manual copy/paste of addresses is needed for navigation.
- [ ] Implementation is accessible and does not interfere with screen readers.

---

