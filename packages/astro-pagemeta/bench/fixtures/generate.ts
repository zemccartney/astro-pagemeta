/**
 * Programmatic HTML fixture generator for benchmarks.
 * Produces deterministic, valid HTML documents at target byte counts
 * with realistic DOM structure (headings, paragraphs, code blocks,
 * lists, tables) so parse5's behavior is representative.
 */

const HEAD_TEMPLATE = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>Benchmark Page</title>
<meta name="description" content="A benchmark test page for measuring rehype processing overhead">
<link rel="canonical" href="https://example.com/benchmark">`;

// Building blocks for body content, each ~200-500 bytes
const BLOCKS = [
    // Paragraph with inline formatting (~300 bytes)
    `<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>`,

    // Heading + paragraph (~250 bytes)
    `<h2>Section Heading</h2>
<p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.</p>`,

    // Code block (~350 bytes)
    `<pre><code>function processData(items) {
  return items
    .filter(item =&gt; item.active)
    .map(item =&gt; ({
      id: item.id,
      name: item.name.trim(),
      score: Math.round(item.score * 100) / 100
    }));
}</code></pre>`,

    // Unordered list (~300 bytes)
    `<ul>
<li>First item with some descriptive text about the feature</li>
<li>Second item explaining another important aspect of the system</li>
<li>Third item covering edge cases and error handling approaches</li>
<li>Fourth item discussing performance and optimization strategies</li>
</ul>`,

    // Nested blockquote (~250 bytes)
    `<blockquote>
<p>This is a notable quote from the documentation that explains an important concept about how the system processes metadata and injects tags.</p>
</blockquote>`,

    // Table (~400 bytes)
    `<table>
<thead><tr><th>Property</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
<tbody>
<tr><td>title</td><td>string</td><td>undefined</td><td>Page title for the document</td></tr>
<tr><td>description</td><td>string</td><td>undefined</td><td>Meta description tag content</td></tr>
<tr><td>og</td><td>boolean</td><td>false</td><td>Enable OpenGraph meta tags</td></tr>
</tbody>
</table>`,

    // Definition list (~280 bytes)
    `<dl>
<dt>Automatic Mode</dt>
<dd>Middleware intercepts the response and injects meta tags into the rendered HTML post-render.</dd>
<dt>Manual Mode</dt>
<dd>The Head component processes only head content, preserving HTML streaming capability.</dd>
</dl>`,

    // Nested div structure (~350 bytes)
    `<div class="card">
<div class="card-header"><h3>Feature Card</h3></div>
<div class="card-body">
<p>This component demonstrates a common layout pattern with nested elements, similar to what you'd find in a real Astro component's rendered output.</p>
</div>
<div class="card-footer"><a href="/learn-more">Learn more</a></div>
</div>`
];

/**
 * Generate a valid HTML document of approximately the given body size.
 * Head content is constant (~250 bytes). Body is filled with repeating
 * content blocks to reach the target size.
 * @param options - Generation options
 * @param options.bodyKB - Target body size in kilobytes
 * @returns A valid HTML document string
 */
export function generateHtml(options: { bodyKB: number }): string {
    const targetBytes = options.bodyKB * 1024;
    const bodyParts: string[] = [];
    let currentSize = 0;
    let blockIndex = 0;

    while (currentSize < targetBytes) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- BLOCKS is a fixed-length array, modulo guarantees valid index
        const block = BLOCKS[blockIndex % BLOCKS.length]!;
        bodyParts.push(block);
        currentSize += block.length;
        blockIndex++;
    }

    return `<!DOCTYPE html>
<html>
<head>
${HEAD_TEMPLATE}
</head>
<body>
<main>
${bodyParts.join("\n")}
</main>
</body>
</html>`;
}

/**
 * Pre-generated fixtures at standard benchmark sizes, aligned with the
 * 2025 Web Almanac HTML size distribution (https://almanac.httparchive.org/en/2025/page-weight).
 *
 * The Almanac reports compressed (transfer) sizes. These fixtures use estimated
 * raw (uncompressed) sizes at ~4x compression ratio, which is what our middleware
 * actually processes.
 *
 * | Percentile | Transfer (compressed) | Raw (~4x) |
 * |---|---|---|
 * | p10  |   6 KB |  ~25 KB  |
 * | p25  |  14 KB |  ~55 KB  |
 * | p50  |  35 KB | ~140 KB  |
 * | p75  |  78 KB | ~310 KB  |
 * | p90  | 152 KB | ~610 KB  |
 */
export const FIXTURES = {
    "p10 (25 KB)": generateHtml({ bodyKB: 25 }),
    "p25 (55 KB)": generateHtml({ bodyKB: 55 }),
    "p50 (140 KB)": generateHtml({ bodyKB: 140 }),
    "p75 (310 KB)": generateHtml({ bodyKB: 310 }),
    "p90 (610 KB)": generateHtml({ bodyKB: 610 })
} as const;

/** The head content that the Head component would receive (slot children). */
export const HEAD_CONTENT = HEAD_TEMPLATE;
