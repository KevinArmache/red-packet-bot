const fs = require('fs');

function parseNitterDate(block) {
  const m1 = block.match(/class="[^"]*tweet-date[^"]*"[^>]*>\s*<a[^>]*title="([^"]+)"/i);
  if (m1) {
    const raw = m1[1].replace(/·/g, "").replace(/\s+/g, " ").trim();
    const withTz = raw.endsWith("UTC") ? raw.replace("UTC", "+00:00") : raw;
    const ts = Date.parse(withTz);
    if (!isNaN(ts)) return ts;
  }
  return null;
}

const html1 = '<span class="tweet-date"><a href="/status/123" title="May 18, 2026 · 10:45 PM UTC">May 18</a></span>';
console.log("HTML 1:", new Date(parseNitterDate(html1)));

const html2 = '<span class="tweet-date"><a href="/status/123" title="Jan 2, 2026 · 4:05 AM UTC">Jan 2</a></span>';
console.log("HTML 2:", new Date(parseNitterDate(html2)));

