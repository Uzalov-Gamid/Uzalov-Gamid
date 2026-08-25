import { mkdir, writeFile } from "node:fs/promises";

const user = process.env.GITHUB_USER || "Uzalov-Gamid";
const token = process.env.GITHUB_TOKEN;
const api = "https://api.github.com";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "github-profile-terminal-metrics",
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

function escapeXml(value) {
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
  .slice(0, 6)
  .map(([name, bytes]) => ({
    name,
    percent: totalBytes ? (bytes / totalBytes) * 100 : 0,
  }));

const stars = owned.reduce((sum, repository) => sum + repository.stargazers_count, 0);
const forks = owned.reduce((sum, repository) => sum + repository.forks_count, 0);
const latest = [...sourceRepos].sort(
  (a, b) => new Date(b.pushed_at) - new Date(a.pushed_at),
)[0];
const colors = ["#58a6ff", "#7ee787", "#d2a8ff", "#f2cc60", "#ff7b72", "#a5d6ff"];

const languageRows = topLanguages.length
  ? topLanguages
      .map(({ name, percent }, index) => {
        const y = 139 + index * 31;
        const blocks = Math.max(1, Math.round((percent / 100) * 18));
        const bar = `${"#".repeat(blocks)}${".".repeat(18 - blocks)}`;
        return `
    <text x="570" y="${y}" fill="${colors[index]}" font-size="15">${escapeXml(short(name.toUpperCase(), 12).padEnd(12))}</text>
    <text x="700" y="${y}" fill="${colors[index]}" font-size="15">[${bar}]</text>
    <text x="918" y="${y}" text-anchor="end" fill="#c9d1d9" font-size="14">${percent.toFixed(1).padStart(5)}%</text>`;
      })
      .join("")
  : '<text x="570" y="139" fill="#8b949e" font-size="15">no public language data</text>';

const latestText = latest ? `${short(latest.name)} · ${date(latest.pushed_at)}` : "no public pushes";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="340" viewBox="0 0 1000 340" role="img" aria-labelledby="title desc">
  <title id="title">Live GitHub statistics for ${escapeXml(user)}</title>
  <desc id="desc">A terminal showing public repositories, followers, stars, forks, latest push and languages.</desc>
  <defs>
    <linearGradient id="metricsBackground" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#070b12"/>
      <stop offset="0.55" stop-color="#0d1522"/>
      <stop offset="1" stop-color="#101c2c"/>
    </linearGradient>
    <linearGradient id="metricsBorder" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#3fb950"/>
      <stop offset="0.5" stop-color="#58a6ff"/>
      <stop offset="1" stop-color="#a371f7"/>
    </linearGradient>
    <pattern id="metricsScanlines" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="1" fill="#8b949e" opacity="0.04"/>
    </pattern>
  </defs>

  <rect x="1" y="1" width="998" height="338" rx="20" fill="url(#metricsBackground)" stroke="url(#metricsBorder)" stroke-width="2"/>
  <rect x="1" y="1" width="998" height="338" rx="20" fill="url(#metricsScanlines)"/>
  <circle cx="30" cy="28" r="6" fill="#ff5f56"/>
  <circle cx="50" cy="28" r="6" fill="#ffbd2e"/>
  <circle cx="70" cy="28" r="6" fill="#27c93f"/>
  <text x="500" y="33" text-anchor="middle" fill="#8b949e" font-size="14" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">gh-status --public</text>
  <line x1="1" y1="52" x2="999" y2="52" stroke="#30363d"/>

  <g font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">
    <text x="48" y="91" fill="#58a6ff" font-size="16">${escapeXml(user.toLowerCase())}@github:~$</text>
    <text x="275" y="91" fill="#c9d1d9" font-size="16">gh api /users/${escapeXml(user)}</text>

    <text x="48" y="132" fill="#8b949e" font-size="15">owned repos</text>
    <text x="222" y="132" fill="#7ee787" font-size="15">${owned.length}</text>
    <text x="48" y="164" fill="#8b949e" font-size="15">followers</text>
    <text x="222" y="164" fill="#7ee787" font-size="15">${profile.followers}</text>
    <text x="48" y="196" fill="#8b949e" font-size="15">stars received</text>
    <text x="222" y="196" fill="#7ee787" font-size="15">${stars}</text>
    <text x="48" y="228" fill="#8b949e" font-size="15">forks</text>
    <text x="222" y="228" fill="#7ee787" font-size="15">${forks}</text>
    <text x="48" y="260" fill="#8b949e" font-size="15">latest push</text>
    <text x="222" y="260" fill="#f2cc60" font-size="15">${escapeXml(latestText)}</text>

    <text x="570" y="91" fill="#58a6ff" font-size="16">${escapeXml(user.toLowerCase())}@github:~$</text>
    <text x="800" y="91" fill="#c9d1d9" font-size="16">languages --top 6</text>
${languageRows}

    <text x="48" y="315" fill="#484f58" font-size="12">public data · updated daily · ${timestamp()} MSK</text>
    <rect x="931" y="301" width="10" height="17" rx="1" fill="#58a6ff">
      <animate attributeName="opacity" values="1;1;0;0" dur="1s" repeatCount="indefinite"/>
    </rect>
  </g>

  <rect x="18" y="58" width="964" height="2" fill="#58a6ff" opacity="0.13">
    <animate attributeName="y" values="58;322;58" dur="7s" repeatCount="indefinite"/>
  </rect>
</svg>
`;

await mkdir("profile", { recursive: true });
await writeFile("profile/terminal-metrics.svg", svg, "utf8");
console.log(`Generated terminal metrics for ${user}`);
