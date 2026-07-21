/**
 * Convert Markdown draft text to clean plain text for copy/paste into platforms
 * that don't render Markdown (LinkedIn, X, etc.). Strips emphasis (** *), headings
 * (#), blockquotes (>), list bullets, inline code, and link/image syntax while
 * keeping the words intact. Chosen over Unicode-bold so nothing shows as stray
 * characters anywhere.
 */
export function toPlainText(md: string | null | undefined): string {
  if (!md) return "";
  return md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, "").trim()) // fenced code
    .replace(/`([^`]+)`/g, "$1")               // inline code
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")         // headings
    .replace(/^\s{0,3}>\s?/gm, "")              // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "")              // bullet lists
    .replace(/\*\*([^*]+)\*\*/g, "$1")          // bold **
    .replace(/__([^_]+)__/g, "$1")              // bold __
    .replace(/\*([^*]+)\*/g, "$1")              // italic *
    .replace(/_([^_]+)_/g, "$1")                // italic _
    .replace(/~~([^~]+)~~/g, "$1")              // strikethrough
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")       // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")    // links -> text
    .replace(/[ \t]+\n/g, "\n")                 // trailing spaces
    .replace(/\n{3,}/g, "\n\n")                 // collapse blank lines
    .trim();
}
