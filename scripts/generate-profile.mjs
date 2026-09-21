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
const MUTED = "#d6d6d8";
const LABEL = "#828288";

const parts = [];
let y = 0;

function label(text) {
  parts.push(`<text x="${PAD}" y="${y + 26}" fill="${LABEL}" font-size="13" font-weight="600" letter-spacing="2">${esc(text)}</text>`);
  parts.push(`<line x1="${PAD}" y1="${y + 42}" x2="${RIGHT}" y2="${y + 42}" stroke="${DIVIDER}" stroke-width="1"/>`);
}

function divider(offset) {
  parts.push(`<line x1="${PAD}" y1="${y + offset}" x2="${RIGHT}" y2="${y + offset}" stroke="${DIVIDER}" stroke-width="1"/>`);
}

// ---- header ------------------------------------------------------------
parts.push(`<text x="${PAD}" y="${y + 68}" fill="${PRIMARY}" font-size="38" font-weight="700" letter-spacing="0.5">GAMID UZALOV</text>`);
parts.push(`<text x="${PAD}" y="${y + 100}" fill="${SECONDARY}" font-size="19">Linux · Automation · Infrastructure</text>`);
divider(126);
parts.push(`<text x="${PAD}" y="${y + 160}" fill="${SECONDARY}" font-size="16">Telegram · @uzalovgamid</text>`);
parts.push(`<text x="${PAD + 350}" y="${y + 160}" fill="${SECONDARY}" font-size="16">Email · uzalovgamid@gmail.com</text>`);
parts.push(`<text x="${RIGHT}" y="${y + 160}" text-anchor="end" fill="#d6d6d9" font-size="16">Moscow, RU · Open to junior roles</text>`);
y += 196;

// ---- profile -------------------------------------------------------------
label("PROFILE");
parts.push(`<text x="${PAD}" y="${y + 80}" fill="${MUTED}" font-size="19">Started in Python development, now moving into Linux administration and DevOps.</text>`);
parts.push(`<text x="${PAD}" y="${y + 112}" fill="${MUTED}" font-size="19">Practicing at School 21 and on my own lab environments.</text>`);
parts.push(`<text x="${PAD}" y="${y + 144}" fill="${MUTED}" font-size="19">Every task becomes a reproducible project with CI.</text>`);
y += 172;

// ---- stack ---------------------------------------------------------------
label("STACK");
const stackRows = [
  ["SYSTEMS", "Linux · systemd · SSH · TCP/IP · DNS"],
  ["AUTOMATION", "Bash · Python · Git · CI/CD"],
  ["PLATFORM", "Docker · Docker Compose · Kubernetes"],
  ["DATA & OBS", "PostgreSQL · SQL · Prometheus · Grafana"],
];
const STACK_ROW = 50;
stackRows.forEach(([category, values], index) => {
  const rowY = y + 88 + index * STACK_ROW;
  parts.push(`<text x="${PAD}" y="${rowY}" fill="${MUTED}" font-size="17" font-weight="600">${esc(category)}</text>`);
  parts.push(`<text x="${PAD + 260}" y="${rowY}" fill="${SECONDARY}" font-size="18">${esc(values)}</text>`);
  if (index < stackRows.length - 1) {
    divider(88 + index * STACK_ROW + 25);
  }
});
y += 88 + (stackRows.length - 1) * STACK_ROW + 42;

// ---- projects --------------------------------------------------------------
label("PROJECTS");
const groups = [
  ["LINUX", [
    ["linux-challenge-lab", "Ubuntu lab environment for administration practice"],
    ["linux-admin-toolkit", "Backups, disk/process reports, access-log analysis"],
  ]],
  ["INFRASTRUCTURE & DEVOPS", [
    ["fastapi-monitoring-stack", "Application with Prometheus metrics and a Grafana dashboard"],
    ["k8s-mini-lab", "FastAPI on Kubernetes: ConfigMap, Secret, Service, Ingress, CI"],
    ["devops-lab", "Backend on PostgreSQL, Redis and nginx behind Docker Compose"],
  ]],
  ["BACKEND", [
    ["doit", "Django application with PostgreSQL, Docker Compose, tests and CI"],
  ]],
];

let cursor = 76;
groups.forEach(([group, items], groupIndex) => {
  if (groupIndex > 0) cursor += 36;
  parts.push(`<text x="${PAD}" y="${y + cursor}" fill="${SECONDARY}" font-size="14" font-weight="700" letter-spacing="2.5">${esc(group)}</text>`);
  cursor += 34;
  items.forEach(([name, description], itemIndex) => {
    parts.push(`<text x="${PAD}" y="${y + cursor}" fill="${PRIMARY}" font-size="18" font-weight="600">${esc(name)}</text>`);
    parts.push(`<text x="${PAD}" y="${y + cursor + 25}" fill="${SECONDARY}" font-size="16">${esc(description)}</text>`);
    cursor += 42;
    const isLastItem = itemIndex === items.length - 1;
    if (!isLastItem) {
      divider(cursor);
      cursor += 27;
    } else if (groupIndex < groups.length - 1) {
      divider(cursor);
    }
  });
});
const projectsHeight = cursor + 30;
y += projectsHeight;

// ---- education -------------------------------------------------------------
label("EDUCATION");
parts.push(`<text x="${PAD}" y="${y + 80}" fill="${MUTED}" font-size="19">School 21 (Sber) — DevOps/Linux track, since 2025</text>`);
parts.push(`<text x="${PAD}" y="${y + 114}" fill="${MUTED}" font-size="19">College of World Economy and Advanced Technologies — CS/IT program, graduating 2028</text>`);
y += 142;

// ---- github stats ------------------------------------------------------------
label("GITHUB");
const STAT_ROW = 34;
const statRows = [
  ["Owned repos", owned.length],
  ["Followers", profile.followers],
  ["Stars received", stars],
  ["Forks", forks],
  ["Latest push", latestText],
];
statRows.forEach(([statLabel, value], index) => {
  const rowY = y + 88 + index * STAT_ROW;
  parts.push(`<text x="${PAD}" y="${rowY}" fill="${SECONDARY}" font-size="16">${esc(statLabel)}</text>`);
  parts.push(`<text x="${PAD + 328}" y="${rowY}" fill="${PRIMARY}" font-size="16" font-weight="600">${esc(String(value))}</text>`);
});

const barX = PAD + 608;
const barWidth = 220;
const languageRows = topLanguages.length
  ? topLanguages
      .map(({ name, percent }, index) => {
        const rowY = y + 88 + index * STAT_ROW;
        const filled = Math.max(2, Math.round((percent / 100) * barWidth));
        const opacity = (1 - index * 0.14).toFixed(2);
        return `
    <text x="${PAD + 608}" y="${rowY}" fill="${SECONDARY}" font-size="16">${esc(short(name, 14))}</text>
    <rect x="${barX + 130}" y="${rowY - 13}" width="${barWidth}" height="4" rx="2" fill="${DIVIDER}"/>
    <rect x="${barX + 130}" y="${rowY - 13}" width="${filled}" height="4" rx="2" fill="${PRIMARY}" opacity="${opacity}"/>
    <text x="${RIGHT}" y="${rowY}" text-anchor="end" fill="${SECONDARY}" font-size="15">${percent.toFixed(1)}%</text>`;
      })
      .join("")
  : `<text x="${PAD + 608}" y="${y + 88}" fill="${SECONDARY}" font-size="16">no public language data</text>`;
parts.push(languageRows);

const statsBottom = 88 + (statRows.length - 1) * STAT_ROW;
divider(statsBottom + 28);
parts.push(`<text x="${PAD}" y="${y + statsBottom + 54}" fill="${LABEL}" font-size="13">Public data · updated daily · ${timestamp()} MSK</text>`);
y += statsBottom + 76;

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
