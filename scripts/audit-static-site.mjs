import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const siteRoot = path.resolve("site");
const issues = [];
let htmlCount = 0;
let linkCount = 0;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

async function existsFile(candidate) {
  try {
    const info = await stat(candidate);
    if (info.isDirectory()) {
      const indexInfo = await stat(path.join(candidate, "index.html")).catch(() => null);
      return Boolean(indexInfo?.isFile());
    }
    return info.isFile();
  } catch {
    if (!path.extname(candidate)) {
      try {
        const info = await stat(path.join(candidate, "index.html"));
        return info.isFile();
      } catch {
        return false;
      }
    }
    return false;
  }
}

const files = await walk(siteRoot);
const htmlFiles = files.filter(file => /\.html?$/i.test(file));

for (const file of htmlFiles) {
  htmlCount += 1;
  const html = await readFile(file, "utf8");
  const relativeFile = path.relative(process.cwd(), file);

  if (/\\n\s*<(?:a|nav|div|section|script|link)\b/i.test(html)) {
    issues.push(relativeFile + ": literal \\n escape appears before an HTML element");
  }

  const attributes = /\b(?:href|src|poster|action)\s*=\s*(["'])(.*?)\1/gi;
  for (const match of html.matchAll(attributes)) {
    const raw = match[2].trim();
    if (!raw || raw.startsWith("#") || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) continue;

    let pathname = raw.split(/[?#]/, 1)[0];
    if (!pathname) continue;
    try { pathname = decodeURIComponent(pathname); } catch {}

    const target = pathname.startsWith("/")
      ? path.resolve(siteRoot, "." + pathname)
      : path.resolve(path.dirname(file), pathname);
    const relativeTarget = path.relative(siteRoot, target);
    if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
      issues.push(relativeFile + ": local reference escapes site/: " + raw);
      continue;
    }

    linkCount += 1;
    if (!await existsFile(target)) {
      issues.push(relativeFile + ": missing local target " + raw);
    }
  }
}

if (issues.length) {
  console.error("Static site audit found " + issues.length + " issue(s):");
  for (const issue of issues) console.error("- " + issue);
  process.exitCode = 1;
} else {
  console.log("Static site audit passed: " + htmlCount + " HTML files and " + linkCount + " local references checked.");
}
