## AID-03: Map Points Specification

On the **MAPA** tab, display the following types of points:

- **Aid Centers (acopios)**  
  - Source: Static image metadata  
  - Use exact location (address/city/state/country)  
- **Professionals (personal)**  
  - Source: Static image metadata  
  - Use precise location data  
- **Recent Aftershocks and Earthquakes**  
  - Source: Scrape http://www.funvisis.gob.ve/index.php for the latest seismic events  
  - Parse and geolocate recent earthquakes

### Visual Differentiation

- Use distinct colors and icons for each point type:
  - Aid Centers: blue marker/Cross
  - Professionals: red marker/User
  - Earthquakes/Aftershocks: yellow marker/wave

### Requirements

- All humanitarian points (acopios, professionals) must be mapped from the static image metadata.
- Earthquake points must be dynamically scraped and added to the map in real time.
- The map must clearly distinguish each point type by color and icon for easy visual identification.