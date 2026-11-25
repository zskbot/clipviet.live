const root = document.querySelector("#integration-grid");
const year = document.querySelector("#year");
if (year) year.textContent = String(new Date().getFullYear());

function make(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

async function loadRegistry() {
  try {
    const response = await fetch("./providers.json", { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const providers = await response.json();
    if (!Array.isArray(providers)) throw new Error("Registry format is invalid");
    root.replaceChildren();
    for (const provider of providers) {
      const card = make("article", undefined, "integration-card");
      const meta = make("div", undefined, "integration-meta");
      meta.append(make("span", provider.kind, "integration-kind"));
      meta.append(make("span", provider.status, "integration-status"));
      const title = make("h2", provider.name);
      const role = make("p", provider.role);
      const readiness = make("p", provider.readiness);
      const link = make("a", "MỞ REPOSITORY ↗");
      link.href = provider.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      card.append(meta, title, role, readiness, link);
      root.append(card);
    }
  } catch (error) {
    root.replaceChildren(make("p", "Không tải được registry: " + error.message, "sources-intro"));
  }
}
loadRegistry();