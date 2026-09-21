import { mkdir, writeFile } from "node:fs/promises";

const user = process.env.GITHUB_USER || "Uzalov-Gamid";
const token = process.env.GITHUB_TOKEN;
const api = "https://api.github.com";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "github-profile-generator",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function get(path) {
  const response = await fetch(`${api}${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${path}`);
  }
  return response.json();
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function short(value, limit = 28) {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function date(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function timestamp() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

const [profile, repositories] = await Promise.all([
  get(`/users/${encodeURIComponent(user)}`),
  get(`/users/${encodeURIComponent(user)}/repos?type=owner&sort=updated&per_page=100`),
]);

const owned = repositories.filter((repository) => !repository.fork);
const sourceRepos = owned.filter(
  (repository) => repository.name.toLowerCase() !== user.toLowerCase(),
);
const languageSets = await Promise.all(
  sourceRepos.map((repository) =>
    get(`/repos/${encodeURIComponent(user)}/${encodeURIComponent(repository.name)}/languages`),
  ),
);

const languages = new Map();
for (const set of languageSets) {
  for (const [language, bytes] of Object.entries(set)) {
    languages.set(language, (languages.get(language) || 0) + bytes);
  }
}

const totalBytes = [...languages.values()].reduce((sum, bytes) => sum + bytes, 0);
const topLanguages = [...languages.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([name, bytes]) => ({ name, percent: totalBytes ? (bytes / totalBytes) * 100 : 0 }));

const stars = owned.reduce((sum, repository) => sum + repository.stargazers_count, 0);
const forks = owned.reduce((sum, repository) => sum + repository.forks_count, 0);
const latest = [...sourceRepos].sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))[0];
const latestText = latest ? `${short(latest.name)} · ${date(latest.pushed_at)}` : "no public pushes";

// ---- design tokens ----------------------------------------------------
const W = 1200;
const PAD = 32;
const RIGHT = W - PAD;
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const BG = "#0b0b0d";
const BORDER = "#26262a";
const DIVIDER = "#1d1d20";
const PRIMARY = "#f4f4f5";
const SECONDARY = "#9a9a9e";
const MUTED = "#d4d4d6";
const LABEL = "#7a7a80";

const parts = [];
let y = 0;

function label(text) {
  parts.push(`<text x="${PAD}" y="${y + 24}" fill="${LABEL}" font-size="12" font-weight="600" letter-spacing="2">${esc(text)}</text>`);
  parts.push(`<line x1="${PAD}" y1="${y + 38}" x2="${RIGHT}" y2="${y + 38}" stroke="${DIVIDER}" stroke-width="1"/>`);
}

function divider(offset) {
  parts.push(`<line x1="${PAD}" y1="${y + offset}" x2="${RIGHT}" y2="${y + offset}" stroke="${DIVIDER}" stroke-width="1"/>`);
}

// ---- header ------------------------------------------------------------
parts.push(`<text x="${PAD}" y="${y + 64}" fill="${PRIMARY}" font-size="34" font-weight="700" letter-spacing="0.5">GAMID UZALOV</text>`);
parts.push(`<text x="${PAD}" y="${y + 94}" fill="${SECONDARY}" font-size="17">Linux · Automation · Infrastructure</text>`);
divider(118);
parts.push(`<text x="${PAD}" y="${y + 150}" fill="${SECONDARY}" font-size="14">Telegram · @uzalovgamid</text>`);
parts.push(`<text x="${PAD + 330}" y="${y + 150}" fill="${SECONDARY}" font-size="14">Email · uzalovgamid@gmail.com</text>`);
parts.push(`<text x="${RIGHT}" y="${y + 150}" text-anchor="end" fill="#cfcfd2" font-size="14">Moscow, RU · Open to junior roles</text>`);
y += 184;

// ---- profile -------------------------------------------------------------
label("ПРОФИЛЬ");
parts.push(`<text x="${PAD}" y="${y + 74}" fill="${MUTED}" font-size="17">Начинал с Python-разработки, сейчас перехожу в администрирование Linux и DevOps.</text>`);
parts.push(`<text x="${PAD}" y="${y + 104}" fill="${MUTED}" font-size="17">Практику получаю в Школе 21 и на собственных лабораторных стендах.</text>`);
parts.push(`<text x="${PAD}" y="${y + 134}" fill="${MUTED}" font-size="17">Каждую задачу довожу до воспроизводимого проекта с CI.</text>`);
y += 160;

// ---- stack ---------------------------------------------------------------
label("СТЕК");
const stackRows = [
  ["SYSTEMS", "Linux · systemd · SSH · TCP/IP · DNS"],
  ["AUTOMATION", "Bash · Python · Git · CI/CD"],
  ["PLATFORM", "Docker · Docker Compose · Kubernetes"],
  ["DATA & OBS", "PostgreSQL · SQL · Prometheus · Grafana"],
];
stackRows.forEach(([category, values], index) => {
  const rowY = y + 82 + index * 46;
  parts.push(`<text x="${PAD}" y="${rowY}" fill="${MUTED}" font-size="15" font-weight="600">${esc(category)}</text>`);
  parts.push(`<text x="${PAD + 248}" y="${rowY}" fill="${SECONDARY}" font-size="16">${esc(values)}</text>`);
  if (index < stackRows.length - 1) {
    divider(82 + index * 46 + 23);
  }
});
y += 244;

// ---- projects --------------------------------------------------------------
label("ПРОЕКТЫ");
const groups = [
  ["LINUX", [
    ["linux-challenge-lab", "Лабораторное окружение Ubuntu для практики администрирования"],
    ["linux-admin-toolkit", "Бэкапы, отчёты по дискам и процессам, разбор access-логов"],
  ]],
  ["INFRASTRUCTURE & DEVOPS", [
    ["fastapi-monitoring-stack", "Приложение с метриками Prometheus и дашбордом Grafana"],
    ["k8s-mini-lab", "FastAPI в Kubernetes: ConfigMap, Secret, Service, Ingress, CI"],
    ["devops-lab", "Бэкенд на PostgreSQL, Redis и nginx за Docker Compose"],
  ]],
  ["BACKEND", [
    ["doit", "Django-приложение с PostgreSQL, Docker Compose, тестами и CI"],
  ]],
];

let cursor = 70;
groups.forEach(([group, items], groupIndex) => {
  if (groupIndex > 0) cursor += 32;
  parts.push(`<text x="${PAD}" y="${y + cursor}" fill="${SECONDARY}" font-size="13" font-weight="700" letter-spacing="2.5">${esc(group)}</text>`);
  cursor += 30;
  items.forEach(([name, description], itemIndex) => {
    parts.push(`<text x="${PAD}" y="${y + cursor}" fill="${PRIMARY}" font-size="16" font-weight="600">${esc(name)}</text>`);
    parts.push(`<text x="${PAD}" y="${y + cursor + 22}" fill="${SECONDARY}" font-size="14">${esc(description)}</text>`);
    cursor += 38;
    const isLastItem = itemIndex === items.length - 1;
    if (!isLastItem) {
      divider(cursor);
      cursor += 24;
    } else if (groupIndex < groups.length - 1) {
      divider(cursor);
    }
  });
});
const projectsHeight = cursor + 26;
y += projectsHeight;

// ---- education -------------------------------------------------------------
label("ОБРАЗОВАНИЕ");
parts.push(`<text x="${PAD}" y="${y + 74}" fill="${MUTED}" font-size="17">Школа 21 от Сбера — направление DevOps/Linux, с 2025 года</text>`);
parts.push(`<text x="${PAD}" y="${y + 106}" fill="${MUTED}" font-size="17">Колледж мировой экономики и передовых технологий — ИСиП, выпуск 2028</text>`);
y += 132;

// ---- github stats ------------------------------------------------------------
label("GITHUB");
const statRows = [
  ["Owned repos", owned.length],
  ["Followers", profile.followers],
  ["Stars received", stars],
  ["Forks", forks],
  ["Latest push", latestText],
];
statRows.forEach(([statLabel, value], index) => {
  const rowY = y + 82 + index * 32;
  parts.push(`<text x="${PAD}" y="${rowY}" fill="${SECONDARY}" font-size="14">${esc(statLabel)}</text>`);
  parts.push(`<text x="${PAD + 328}" y="${rowY}" fill="${PRIMARY}" font-size="14" font-weight="600">${esc(String(value))}</text>`);
});

const barX = PAD + 608;
const barWidth = 220;
const languageRows = topLanguages.length
  ? topLanguages
      .map(({ name, percent }, index) => {
        const rowY = y + 82 + index * 32;
        const filled = Math.max(2, Math.round((percent / 100) * barWidth));
        const opacity = (1 - index * 0.14).toFixed(2);
        return `
    <text x="${PAD + 608}" y="${rowY}" fill="${SECONDARY}" font-size="14">${esc(short(name, 14))}</text>
    <rect x="${barX + 130}" y="${rowY - 12}" width="${barWidth}" height="4" rx="2" fill="${DIVIDER}"/>
    <rect x="${barX + 130}" y="${rowY - 12}" width="${filled}" height="4" rx="2" fill="${PRIMARY}" opacity="${opacity}"/>
    <text x="${RIGHT}" y="${rowY}" text-anchor="end" fill="${SECONDARY}" font-size="13">${percent.toFixed(1)}%</text>`;
      })
      .join("")
  : `<text x="${PAD + 608}" y="${y + 82}" fill="${SECONDARY}" font-size="14">no public language data</text>`;
parts.push(languageRows);

divider(238);
parts.push(`<text x="${PAD}" y="${y + 262}" fill="${LABEL}" font-size="12">Public data · updated daily · ${timestamp()} MSK</text>`);
y += 280;

const totalHeight = y;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalHeight}" viewBox="0 0 ${W} ${totalHeight}" role="img" aria-labelledby="title desc">
  <title id="title">Gamid Uzalov</title>
  <desc id="desc">Profile, stack, projects, education and live GitHub statistics.</desc>
  <rect x="1" y="1" width="${W - 2}" height="${totalHeight - 2}" rx="10" fill="${BG}" stroke="${BORDER}" stroke-width="1"/>
  <g font-family="${FONT}">
${parts.join("\n")}
  </g>
</svg>
`;

await mkdir("profile", { recursive: true });
await writeFile("profile/profile.svg", svg, "utf8");
console.log(`Generated profile.svg for ${user} (height ${totalHeight})`);
