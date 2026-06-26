// Live listing of the hospital-admissions Drive folder, enumerated server-side
// (the browser can't read the folder page directly because of CORS).
//
// The "Ingresados" tab calls this on each reload; it fetches the public folder,
// extracts every file's id + name, and returns them as JSON. So when someone
// adds a file to the Drive folder, it shows up without rebuilding the site.
// Falls back to the static public/data/ingresados.json if this isn't deployed.

const FOLDER = "1o36ifaRz45kAs5rKzci49aD0mP5JB_YI";
const FOLDER_URL = `https://drive.google.com/drive/folders/${FOLDER}`;

function kindOf(name) {
  const n = name.toLowerCase();
  if (n.includes("consolidado") || n.includes("listas de personas") || n.startsWith("listado"))
    return "consolidado";
  if (name.toUpperCase().startsWith("HOSPITAL")) return "hospital";
  if (n.includes("busqueda") || n.includes("búsqueda")) return "busqueda";
  return "otro";
}
const ORDER = { consolidado: 0, hospital: 1, busqueda: 2, otro: 3 };

export default async () => {
  let items = [];
  try {
    const res = await fetch(FOLDER_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (AyudaVenezuela bot)" },
      signal: AbortSignal.timeout(9000),
    });
    if (res.ok) {
      const html = await res.text();
      // Drive embeds its file list as escaped JSON: "FILE_ID",["FOLDER_ID"],"NAME"
      const un = html.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) =>
        String.fromCharCode(parseInt(h, 16)),
      );
      const re = new RegExp(
        '"([A-Za-z0-9_-]{20,50})",\\["' + FOLDER + '"\\],"((?:[^"\\\\]|\\\\.)+?)"',
        "g",
      );
      const seen = new Map();
      let m;
      while ((m = re.exec(un))) {
        const id = m[1];
        if (id === FOLDER || seen.has(id)) continue;
        let name = m[2].replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
          String.fromCharCode(parseInt(h, 16)),
        );
        name = name.replace(/\\(.)/g, "$1").trim();
        seen.set(id, name);
      }
      items = [...seen]
        .map(([id, name]) => ({
          name,
          url: `https://drive.google.com/open?id=${id}`,
          kind: kindOf(name),
        }))
        // The person-search link lives in the "Servicios" tab, not here.
        .filter((i) => i.kind !== "busqueda");
      items.sort((a, b) =>
        ORDER[a.kind] - ORDER[b.kind] || a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
    }
  } catch {
    /* folder unreachable → return empty; the client falls back to the static file */
  }

  return new Response(
    JSON.stringify({
      folderName: "SISMO 2026 VZLA",
      folderUrl: FOLDER_URL,
      updatedAt: items.length ? new Date().toISOString() : null,
      items,
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=300",
      },
    },
  );
};
