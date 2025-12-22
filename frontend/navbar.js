function renderNavbar(active) {
  const nav = document.getElementById("navbar");
  if (!nav) return;

  const links = [
    { href: "index.html", label: "Home", key: "home" },
    { href: "manual.html", label: "Add Records", key: "manual" },
    { href: "records.html", label: "Records", key: "records" },
    { href: "charts.html", label: "Charts", key: "charts" },
    {
      href: "surveyor-register.html",
      label: "Surveyor Registration",
      key: "surveyor-register",
    },
  ];

  const linkHtml = links
    .map((link) => {
      const isActive = link.key === active;
      const base =
        "inline-flex items-center justify-center min-w-[110px] px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200";
      const state = isActive
        ? "bg-blue-100 text-blue-800 border border-blue-200 shadow-sm"
        : "text-slate-700 hover:text-blue-800 hover:bg-blue-50 hover:shadow-sm hover:-translate-y-px active:translate-y-0 active:shadow-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:outline-none";
      return `<li><a href="${link.href}" class="${base} ${state}">${link.label}</a></li>`;
    })
    .join("");

  nav.innerHTML = `
    <nav class="bg-white shadow-sm border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center space-x-2 text-slate-800 font-semibold">
          <span class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white text-lg">DM</span>
          <div>
            <div class="leading-tight">Demographics Hub</div>
          </div>
        </div>
        <div class="w-full sm:w-auto overflow-x-auto">
          <ul class="flex flex-wrap gap-2 text-slate-800 w-max">${linkHtml}</ul>
        </div>
      </div>
    </nav>
  `;
}
