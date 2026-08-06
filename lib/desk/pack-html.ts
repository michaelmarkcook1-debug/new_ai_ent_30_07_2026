// PackSpec to a self-contained, print-ready document.
//
// The same spec that renders on screen renders here, so the file a reader
// hands to their board cannot disagree with the page they read it on. Built
// and downloaded in the browser: the buyer's decision state never touches a
// server, which is the same promise the shortlist makes.
//
// Self-contained by construction. Styles are inline, there are no external
// fonts or scripts, and every citation is a plain link, so the file opens
// years from now with no network and no dependency. It prints to A4 or Letter
// with one section per page, which is what a board pack has to do.
//
// Escaping runs over every interpolated value rather than only the ones that
// look risky today. The spec is built from vendor names and quoted legal terms
// that already contain ampersands and angle brackets, and a renderer that
// escapes selectively is one new field away from producing broken markup.

import type { PackSpec, PackSection } from "./pack";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sectionHtml(s: PackSection): string {
  const parts: string[] = [];
  parts.push(`<section class="s ${esc(s.kind)}">`);
  parts.push(`<p class="eyebrow">${esc(s.eyebrow)}</p>`);
  parts.push(`<h2>${esc(s.title)}</h2>`);
  if (s.subtitle) parts.push(`<p class="sub">${esc(s.subtitle)}</p>`);

  if (s.lines?.length) {
    parts.push("<ul>");
    for (const l of s.lines) {
      parts.push(
        `<li>${esc(l.text)}${l.source ? ` <span class="src">${esc(l.source)}</span>` : ""}</li>`
      );
    }
    parts.push("</ul>");
  }

  if (s.table) {
    parts.push('<table><thead><tr>');
    for (const h of s.table.headers) parts.push(`<th>${esc(h)}</th>`);
    parts.push("</tr></thead><tbody>");
    for (const row of s.table.rows) {
      parts.push("<tr>");
      row.forEach((c, i) =>
        parts.push(`<td${i === 0 ? ' class="v"' : ""}>${esc(c)}</td>`)
      );
      parts.push("</tr>");
    }
    parts.push("</tbody></table>");
  }

  parts.push("</section>");
  return parts.join("");
}

export function packToHtml(spec: PackSpec): string {
  const body = spec.sections.map(sectionHtml).join("\n");
  const sources = spec.sources
    .map(
      (s) =>
        `<li><a href="${esc(s.url)}">${esc(s.name)}</a><br><span class="url">${esc(s.url)}</span></li>`
    )
    .join("");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.fileTitle)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #14201a; background: #f6f7f6;
  }
  .doc { max-width: 900px; margin: 0 auto; padding: 32px 24px 64px; }
  .s {
    background: #fff; border: 1px solid #dfe4e0; border-radius: 10px;
    padding: 28px 32px; margin: 0 0 18px;
  }
  .eyebrow {
    margin: 0 0 10px; font: 600 10.5px/1.4 ui-monospace, Menlo, Consolas, monospace;
    letter-spacing: .1em; text-transform: uppercase; color: #7b8a81;
  }
  h1 { font-size: 30px; line-height: 1.15; margin: 0 0 6px; letter-spacing: -.02em; }
  h2 { font-size: 22px; line-height: 1.2; margin: 0 0 6px; letter-spacing: -.01em; }
  .cover h2 { font-size: 32px; }
  .sub { margin: 6px 0 0; color: #4d5c54; font-size: 14px; }
  ul { margin: 14px 0 0; padding-left: 18px; }
  li { margin: 0 0 8px; }
  .src {
    display: inline-block; margin-left: 4px; color: #7b8a81;
    font: 10.5px/1.4 ui-monospace, Menlo, Consolas, monospace;
  }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th {
    text-align: left; padding: 8px 10px; background: #eef1ef; color: #2a3a32;
    font: 600 10.5px/1.4 ui-monospace, Menlo, Consolas, monospace;
    letter-spacing: .06em; text-transform: uppercase; border-bottom: 1px solid #dfe4e0;
  }
  td { padding: 8px 10px; border-bottom: 1px solid #eef1ef; color: #4d5c54; }
  td.v { color: #14201a; font-weight: 600; }
  .masthead { padding: 0 0 20px; }
  .masthead p { margin: 4px 0 0; color: #4d5c54; font-size: 13px; }
  .sources li { font-size: 13px; }
  .url { color: #7b8a81; font: 10.5px/1.4 ui-monospace, Menlo, Consolas, monospace; word-break: break-all; }
  a { color: #1d6f4f; }
  @media print {
    body { background: #fff; }
    .doc { max-width: none; padding: 0; }
    .s { border: none; border-radius: 0; padding: 0 0 24px; page-break-after: always; break-after: page; }
    .s:last-of-type { page-break-after: auto; break-after: auto; }
  }
</style>
</head>
<body>
<div class="doc">
  <div class="masthead">
    <h1>${esc(spec.fileTitle)}</h1>
    <p>${esc(spec.dateLabel)} · AnalystGenius</p>
  </div>
${body}
  <section class="s sources">
    <p class="eyebrow">Sources · every grade is re-checkable</p>
    <h2>Sources</h2>
    <ul>${sources}</ul>
  </section>
</div>
</body>
</html>`;
}

/** Build the file in the browser and hand it to the reader. Nothing is posted. */
export function downloadPack(spec: PackSpec): void {
  const html = packToHtml(spec);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${spec.fileTitle.replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-")}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
