AID-07

## AID-07: Organization Name Normalization and Display

### Requirement

- On the **ACOPIOS** page (supply centers), when listing each point in the accordion view (first/summary level), prioritize displaying the **name of the collecting organization** (organizational actor responsible, e.g., NGO, foundation, company, parish, activist group), rather than any informal or non-standard label that may appear in the source image filename or metadata.
- The goal is to make it immediately clear *who* is responsible for the supply drive, regardless of how the image was named or labeled.
- Actual metadata—address, contacts, collection needs, etc.—must remain accurate and unmodified, but the key visual label for each accordion row is the **organization name** only.

### Implementation Guidance

#### 1. Data

- All records in `scripts/image-metadata.json` (merged into `public/images.json`) should include, when available, an `organization` field with the normalized name of the collecting group, entity, or actor.  
  - If the organization is unclear in the original image, infer or standardize it based on the most prominent/canonical name visible (not watermarks or filename conventions).
  - Continue to record *address, needs, schedule,* etc. as sourced from image transcription. Only the display label changes.
  - If no organization is found or applicable, fallback to a generic label (e.g., "Centro de Acopio sin Organización").

#### 2. UI

- In the accordion/list for `/acopio` (supply centers), render:  
  `Accordion summary/title = organization.name` (not filename, code, or image label)
- All other details (expanded panel) remain unchanged—show address, contacts, needs, etc.

#### 3. Markup Example

Assuming your metadata object is like:

```json
{
  "filename": "cen-abc-123.jpg",
  "organization": "Cruz Roja Venezolana",
  "title": "Centro de Acopio Cruz Roja",
  "address": "Plaza XX, Ciudad YY",
  "contact": "(+58) 123-4567",
  "needs": ["alimentos", "agua", "medicina"]
}
```

Accordion summary/title **must show:**  
`Cruz Roja Venezolana`  
*(not the image file, nor the title, unless the organization is absent)*

#### 4. Mark Record with Organization Name

- Ensure that each record is indexed/tagged (in `images.json`) with the `organization` property so that filtering and grouping by organization work correctly.

---

### Acceptance Criteria

- [ ] Accordion view for each acopio displays collecting organization name as the main label.
- [ ] All real-world data fields (address, needs, etc.) remain visible and accurate.
- [ ] Records missing a clear organization are visibly marked/handled (e.g., "Sin Organización").
- [ ] Filtering/grouping by organization works using the normalized names.
- [ ] Image metadata (`image-metadata.json` / `images.json`) always includes an `organization` field for these points.

---