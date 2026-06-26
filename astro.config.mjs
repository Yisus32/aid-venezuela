// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // IMPORTANTE: cambia esto por tu dominio real de despliegue. Las vistas
  // previas de enlaces (Open Graph) usan URLs absolutas, así que la imagen
  // del thumbnail debe servirse desde el dominio correcto.
  site: "https://aid-venezuela.netlify.app",
});
