import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173";
const viewports = [
  { name: "360", width: 360, height: 800, mobile: true },
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "desktop", width: 1440, height: 1000, mobile: false },
];

const videos = Array.from({ length: 35 }, (_, index) => ({
  id: String(index + 1),
  sourceId: "fixture",
  sourceName: "Fixture",
  title: `Fixture video ${index + 1}`,
  poster: "../poster-fallback.svg",
  year: 2026,
  area: "Việt Nam",
  categoryId: "all",
  categoryName: "Tổng hợp",
  duration: "12 phút",
  description: "Fixture content for responsive browser acceptance tests",
  tags: [],
}));

const engine = process.env.BROWSER === "webkit" ? "webkit" : "chromium";
const browser = await (engine === "webkit" ? webkit : chromium).launch({ headless: true });
const failures = [];
await mkdir("artifacts", { recursive: true });

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.mobile ? 2 : 1,
      isMobile: viewport.mobile,
      hasTouch: viewport.mobile,
    });

    await page.route("**/data/catalog.json", route =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          updatedAt: "2026-11-25T00:00:00.000Z",
          providers: [{ id: "fixture", name: "Fixture", state: "ready", count: videos.length }],
          categories: [{ id: "all", sourceId: "fixture", sourceName: "Fixture", name: "Tổng hợp" }],
          videos,
        }),
      }),
    );

    await page.goto(`${baseURL}/browse/`, { waitUntil: "networkidle" });
    await page.locator("#confirm").click();
    await page.locator(".card").first().waitFor();

    const layout = await page.evaluate(() => {
      const form = document.querySelector("#filters");
      const children = [...form.children].map(node => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      const overlaps = [];
      for (let i = 0; i < children.length; i++) {
        for (let j = i + 1; j < children.length; j++) {
          const a = children[i], b = children[j];
          if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) {
            overlaps.push([i, j]);
          }
        }
      }
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        cardColumns: getComputedStyle(document.querySelector("#cards")).gridTemplateColumns.split(" ").length,
        cardCount: document.querySelectorAll(".card").length,
        controlOverlaps: overlaps,
        radii: ["#source", "#keyword", "#prev", ".category-chip"].map(selector =>
          getComputedStyle(document.querySelector(selector)).borderTopLeftRadius
        ),
      };
    });

    assert.ok(layout.documentWidth <= viewport.width, `${viewport.name}px document overflows horizontally: ${layout.documentWidth}px`);
    assert.ok(layout.bodyWidth <= viewport.width, `${viewport.name}px body overflows horizontally: ${layout.bodyWidth}px`);
    assert.deepEqual(layout.controlOverlaps, [], `${viewport.name}px filter controls overlap`);
    assert.deepEqual(layout.radii, ["0px", "0px", "0px", "0px"], `${viewport.name}px controls must have square corners`);
    assert.equal(layout.cardCount, 16, `${viewport.name}px should render one 16-card page`);
    assert.equal(layout.cardColumns, viewport.mobile ? 2 : 5, `${viewport.name}px card grid column count is incorrect`);

    await page.locator("#next").click();
    await page.getByText("Fixture video 17", { exact: true }).waitFor();
    await page.locator("#prev").click();
    await page.getByText("Fixture video 1", { exact: true }).waitFor();

    await page.screenshot({ path: `artifacts/browse-${engine}-${viewport.name}.png`, fullPage: true });
    console.log(`PASS ${engine} ${viewport.name}px: no page overflow, no filter overlap, square controls, ${layout.cardColumns} card columns, pagination works`);
    await page.close();
  }
} catch (error) {
  failures.push(error);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures[0]);
  process.exitCode = 1;
}
