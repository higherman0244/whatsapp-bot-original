function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDuckDuckGoHtml(html, maxResults = 5) {
  const out = [];
  const blocks = String(html || "").split('<div class="result">');
  for (const block of blocks) {
    const linkMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    const rawUrl = linkMatch[1] || "";
    const title = stripTags(linkMatch[2] || "");
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
    const snippetAlt = block.match(/<div[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);
    const snippet = stripTags((snippetMatch && snippetMatch[1]) || (snippetAlt && snippetAlt[1]) || "");
    const decodedUrl = decodeURIComponent(rawUrl.replace(/^\/l\/\?uddg=/, "").split("&rut=")[0]);
    if (!title || !decodedUrl) continue;
    out.push({ title, url: decodedUrl, snippet });
    if (out.length >= maxResults) break;
  }
  return out;
}

async function searchWeb(query, options = {}) {
  const q = String(query || "").trim();
  if (!q) return [];
  const maxResults = Number(options.maxResults || 5);
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  });
  if (!res.ok) throw new Error(`Web search failed (${res.status})`);
  const html = await res.text();
  return parseDuckDuckGoHtml(html, maxResults);
}

function summarizeResults(results, maxItems = 4) {
  const lines = [];
  for (const item of (results || []).slice(0, maxItems)) {
    const snippet = item.snippet ? ` - ${item.snippet}` : "";
    lines.push(`${item.title}${snippet}`);
  }
  return lines.join("\n");
}

module.exports = {
  searchWeb,
  summarizeResults,
};
