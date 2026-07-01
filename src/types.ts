export interface Location {
  country: string;
  state: string;
  city: string;
  address?: string;
}

export interface Contact {
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  website?: string;
  email?: string;
  /** WhatsApp-only: hide the call link, prefill a consultation message. */
  whatsappOnly?: boolean;
}

export interface Person {
  name: string;
  specialty?: string;
  registry?: string;
  contact?: string;
}

export interface CollectionPoint {
  state?: string;
  location: string;
}

export interface Coords {
  lat: number;
  lng: number;
}

export type Urgency = "high" | "medium" | "low";

export interface ImageEntry {
  /** File-system derived fields (added by generate-db). */
  filename: string;
  path: string;
  format: string;
  fileSize: number;
  code: string;

  /** Content mapped from the image itself. */
  category: "center" | "professional";
  urgency?: Urgency;
  title: string;
  organization?: string;
  specialty?: string;
  description?: string;
  location: Location;
  coords?: Coords;
  schedule?: string;
  contact?: Contact;
  needs?: string[];
  acceptsMonetary?: boolean;
  people?: Person[];
  collectionPoints?: CollectionPoint[];
  notes?: string;
  /** Provenance, e.g. "locations.md" for curated image-less addresses. */
  source?: string;
}

export interface ImageDb {
  entries: ImageEntry[];
  generatedAt: string;
}
