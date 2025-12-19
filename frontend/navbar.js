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
        "px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150";
      const state = isActive
        ? "bg-blue-100 text-blue-800 border border-blue-200"
        : "text-slate-700 hover:text-blue-700 hover:bg-blue-50";
      return `<li><a href="${link.href}" class="${base} ${state}">${link.label}</a></li>`;
    })
    .join("");

  nav.innerHTML = `
    <nav class="bg-white shadow-sm border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center space-x-2 text-slate-800 font-semibold">
          <span class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white text-lg">DM</span>
          <div>
            <div class="leading-tight">Demographics Hub</div>
          </div>
        </div>
        <ul class="flex space-x-2 text-slate-800">${linkHtml}</ul>
      </div>
    </nav>
  `;
}
