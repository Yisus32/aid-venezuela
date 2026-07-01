// Country dial codes for the contact selectors. Users pick a code from the
// dropdown instead of typing "+58" as plain text, so submitted numbers always
// carry an explicit international code and the tel:/wa.me link builders never
// have to guess the country. Venezuela is first and is the default.

export interface DialCode {
  code: string; // "+58"
  name: string; // "Venezuela"
}

export const DIAL_CODES: DialCode[] = [
  { code: "+58", name: "Venezuela" },
  { code: "+57", name: "Colombia" },
  { code: "+51", name: "Perú" },
  { code: "+56", name: "Chile" },
  { code: "+54", name: "Argentina" },
  { code: "+55", name: "Brasil" },
  { code: "+593", name: "Ecuador" },
  { code: "+591", name: "Bolivia" },
  { code: "+598", name: "Uruguay" },
  { code: "+595", name: "Paraguay" },
  { code: "+507", name: "Panamá" },
  { code: "+506", name: "Costa Rica" },
  { code: "+52", name: "México" },
  { code: "+1", name: "EE. UU. / Canadá" },
  { code: "+34", name: "España" },
  { code: "+351", name: "Portugal" },
  { code: "+39", name: "Italia" },
];

export const DEFAULT_DIAL = "+58";

// Merge a selected dial code with a locally-typed number into a single
// canonical string like "+58 4121234567". If the user already typed a full
// international number (leading "+"), respect it and ignore the selector.
export function combineDialCode(dial: string, raw: string): string {
  const n = (raw || "").trim();
  if (!n) return "";
  if (n.startsWith("+")) return n.replace(/\s+/g, " ");
  let local = n.replace(/\D/g, "");
  if (local.startsWith("0")) local = local.slice(1); // drop national trunk 0
  if (!local) return "";
  const code = (dial || DEFAULT_DIAL).trim();
  return `${code} ${local}`;
}

// Normalize a contact number to bare wa.me digits, honoring an explicit "+code"
// and defaulting bare/local numbers to Venezuela (mirrors the tel:/wa.me rules).
export function waDigits(n: string): string {
  const s = (n || "").trim();
  if (s.startsWith("+")) return s.replace(/\D/g, "");
  let d = s.replace(/\D/g, "");
  if (d.startsWith("58")) {
    /* ya trae el código de Venezuela */
  } else if (d.startsWith("0")) d = "58" + d.slice(1);
  else d = "58" + d;
  return d;
}

// Build a wa.me link, optionally with a prefilled message.
export function waLink(n: string, message?: string): string {
  const base = `https://wa.me/${waDigits(n)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

// Time-of-day greeting (Spanish). Computed client-side so it reflects the
// viewer's local time, not the server's.
export function waGreeting(hour: number): string {
  if (hour < 12) return "buenos días";
  if (hour < 19) return "buenas tardes";
  return "buenas noches";
}

// Predefined WhatsApp message for "solo WhatsApp" professionals.
export function proWaMessage(hour: number): string {
  return `AYUDA VENEZUELA: Hola ${waGreeting(hour)}, necesito agendar una consulta, soy persona afectada por el terremoto en Venezuela.`;
}

// Split a stored contact number back into { dial, rest } so a selector can be
// pre-populated when editing an existing record. Falls back to the default
// code when the value has no recognizable "+code" prefix.
export function splitDialCode(value: string): { dial: string; rest: string } {
  const v = (value || "").trim();
  if (!v.startsWith("+")) return { dial: DEFAULT_DIAL, rest: v };
  const digits = v.slice(1).replace(/\D/g, "");
  // Longest matching known code wins so "+1" doesn't shadow "+593", etc.
  const match = DIAL_CODES.map((d) => d.code)
    .sort((a, b) => b.length - a.length)
    .find((code) => digits.startsWith(code.slice(1)));
  if (match) return { dial: match, rest: digits.slice(match.length - 1) };
  return { dial: DEFAULT_DIAL, rest: v.replace(/^\+/, "") };
}
