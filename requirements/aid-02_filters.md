AID-02: Filtering Specification

General Requirement:
- Every page that displays lists or sets of data MUST provide user-visible filter controls to refine the visible results.

Tab-Specific Filtering:

- **ACOPIOS Tab**:
  - Must implement UI filters for:
    - Country (dropdown or multi-select; sourced from image metadata)
    - State (dropdown or multi-select; values depend on country selection)
    - Urgency (predefined levels such as "high", "medium", "low"; inferred from metadata or a dedicated field)
    - Donation Type (multi-select; e.g., food, medicine, water, clothes, etc., as present in the "needs" metadata field)
    - Organization name
- **PERSONAL Tab**:
  - Must implement UI filters for:
    - State (dropdown or multi-select; sourced from professional location data)
    - Profession (dropdown; values from "specialty" or "profession" field in metadata)
    - Area (free text or dropdown; describes sector or region, mapped from metadata, e.g., medical, logistics, education)

Notes:
- Filter options must be dynamically derived from available data in `public/images.json` (do not hardcode).
- Filters should support multi-selection where logically appropriate.
- Filtering must update the visible results in real-time without requiring a page reload.
