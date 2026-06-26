AID-01: Layout Specification

- The application must have a persistent sidebar containing exactly three tabs:
  1. **ACOPIOS**
  2. **PERSONAL**
  3. **MAPA**

Tab Functionality:

- **ACOPIOS** tab:
  - Display a list of aid center locations.
  - Locations must be grouped first by country, then by state.
  - Data source: Extract location data from metadata found in `@images`.

- **PERSONAL** tab:
  - Display a list of professionals.
  - For each professional, show: name, contact information, and location.
  - Data source: Extract this information from metadata in `@images`.

- **MAPA** tab:
  - Visualize all available data points (aid centers, professionals, etc) on a world map.
  - The map should be initially centered and zoomed on Venezuela.
  - Must provide a search function to find global locations.

General Constraints:
- All data shown or referenced in these tabs must be sourced from the static image metadata in `@images`.
- The UI layout must make switching between tabs clear and intuitive for the user.