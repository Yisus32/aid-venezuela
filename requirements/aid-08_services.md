AID-08

## AID-08: Services for Locating Missing Persons During the Earthquake

### Purpose

Create a new **"Servicios"** section in the sidebar that catalogs and links to all online services available to help find, report, or search for missing persons during the Venezuela earthquake emergency.

### Services List

Below is the current list of active platforms:

- [reportaven.com](https://reportaven.com)
- [redayudavenezuela.com](https://redayudavenezuela.com)
- [terremoto.hazlohoy.org](https://terremoto.hazlohoy.org/)
- [desaparecidosterremotovenezuela.com](https://desaparecidosterremotovenezuela.com/)

> _Note:_ Both `reportaven.com` and `reportaven.com/` point to the same resource, so only one link needs to be shown in the UI.

### Requirements

- Sidebar must display a "Servicios" tab or entry.
- Within the section, render a list of the above services as clickable links. Each should open in a new browser tab.
- Optionally, add a brief description for each service if time/information is available (recommended for future enhancement).

### Acceptance Criteria

- [ ] "Servicios" appears in the sidebar.
- [ ] All listed services are shown as distinct, clearly-labeled links.
- [ ] Links open the service in a new browser tab (`target="_blank"`, `rel="noopener noreferrer"`).
- [ ] List is easy to update as new services appear or disappear.

---