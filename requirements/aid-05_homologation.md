AID-05
## AID-05: Humanitarian Point Homologation and Location Matching

### Ticket: Homologate and Specify Humanitarian Points (`HUM-01`)

**Problem:**  
- Some humanitarian data points (aid centers, professionals, etc.) have vague or grouped location information in the metadata.
- Multiple records may share a non-specific location (e.g., only city or state), or use inconsistent naming for the same real-world point.
- This makes mapping and grouping less precise.

**Goal:**  
- Ensure that as many humanitarian data points as possible in `image-metadata.json` (and the resulting `public/images.json`) have the *most specific, deduplicated address/location possible*.
- Match and normalize each humanitarian location against a curated/canonical list of distinct known points.
- Reduce ambiguity and enable correct grouping, filtering, and map pinning.

**Approach:**  
1. **Identify Insufficient Specificity:**  
   - Scan all humanitarian entries for loosely defined or repeated/generic locations (e.g., city only, no street address; locations used for >1 aid center or professional).
   - Flag points where `location.address` or `location` data is missing or non-specific, especially if the value is shared between different points.

2. **Match Against Curated Location List:**  
   - Compare each point’s `location` fields (country, state, city, address) with an authoritative list (e.g., from `public/data/locations.md` or a web search of known aid and medical centers in Venezuela).
   - Attempt to normalize location names (e.g., "Lechería" == "Lecheria", ignore accents/case).
   - If a better/specific match is found, update the metadata to use the canonical point.

3. **Deduplication:**  
   - Group points by their resolved/canonical location.
   - For display, allow grouping of all items at the same location.

4. **Web/Manual Augmentation:**  
   - Where ambiguous, run web searches using the current location label plus context (e.g., "Plaza de Puerto Principe, Lechería, Venezuela") to resolve to a street address, GPS coordinates, or known reference.
   - Document additions or corrections for each improved point.

5. **Update Metadata:**  
   - For each fix, update `image-metadata.json` so the exported `images.json` uses the normalized address/location.

6. **Record Provenance:**  
   - Optionally, include a `notes` or `sources` field to document why/how an address was updated (e.g., "matched to known center via web search").

**Deliverables:**  
- List or log of ambiguous/grouped points with their before/after locations.
- Updated metadata files with normalized, specific addresses.
- Short rationale per correction where human research was used.

**Agent-Digestible Acceptance Criteria:**  
- [ ] All humanitarian points in image metadata have the most specific address or unique location available.
- [ ] Locations are matched to a canonical list; no duplicate or ambiguous location clusters remain.
- [ ] Filtering and grouping in the UI functions on these normalized locations.
- [ ] All changes are documented and reviewable via a structured audit log or report.

---