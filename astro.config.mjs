// @ts-check
import { defineConfig } from 'astro/config';

import netlify from "@astrojs/netlify";

// https://astro.build/config
export default defineConfig({
  // Dominio de despliegue. Las vistas previas de enlaces (Open Graph) usan
  // URLs absolutas, así que la imagen del thumbnail se sirve desde aquí.
  site: "https://ayuda-venezuela.talosware.com.ve",

  adapter: netlify(),
});