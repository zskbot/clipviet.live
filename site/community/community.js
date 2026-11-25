(() => {
  const cards = [...document.querySelectorAll(".community-card")];
  const search = document.querySelector("#community-search");
  const filters = [...document.querySelectorAll("[data-filter]")];
  const count = document.querySelector("#community-count");
  const empty = document.querySelector("#community-no-results");
  let active = "all";
  const apply = () => {
    const q = (search?.value || "").trim().toLocaleLowerCase("vi");
    let visible = 0;
    for (const card of cards) {
      const text = (card.textContent + " " + (card.dataset.search || "")).toLocaleLowerCase("vi");
      const show = (active === "all" || card.dataset.group === active) && (!q || text.includes(q));
      card.hidden = !show;
      if (show) visible++;
    }
    if (count) count.textContent = visible + " / " + cards.length + " CHUYÊN MỤC";
    if (empty) empty.hidden = visible !== 0;
  };
  search?.addEventListener("input", apply);
  filters.forEach(button => button.addEventListener("click", () => {
    active = button.dataset.filter || "all";
    filters.forEach(item => item.classList.toggle("is-active", item === button));
    apply();
  }));
  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();
  apply();
})();