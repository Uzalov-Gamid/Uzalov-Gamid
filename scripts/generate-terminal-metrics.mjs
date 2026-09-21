import { mkdir, writeFile } from "node:fs/promises";

const user = process.env.GITHUB_USER || "Uzalov-Gamid";
const token = process.env.GITHUB_TOKEN;
const api = "https://api.github.com";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "github-profile-stats",
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
  .slice(0, 5)
  .map(([name, bytes]) => ({
    name,
    percent: totalBytes ? (bytes / totalBytes) * 100 : 0,
  }));

const stars = owned.reduce((sum, repository) => sum + repository.stargazers_count, 0);
const forks = owned.reduce((sum, repository) => sum + repository.forks_count, 0);
const latest = [...sourceRepos].sort(
  (a, b) => new Date(b.pushed_at) - new Date(a.pushed_at),
)[0];
const latestText = latest ? `${short(latest.name)} · ${date(latest.pushed_at)}` : "no public pushes";

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const TEXT_PRIMARY = "#f4f4f5";
const TEXT_SECONDARY = "#9a9a9e";
const TEXT_LABEL = "#7a7a80";
const DIVIDER = "#1d1d20";

const statRows = [
  ["Owned repos", owned.length],
  ["Followers", profile.followers],
  ["Stars received", stars],
  ["Forks", forks],
  ["Latest push", latestText],
];

const statLines = statRows
  .map(([label, value], index) => {
    const y = 98 + index * 32;
    return `
    <text x="32" y="${y}" fill="${TEXT_SECONDARY}" font-size="14">${escapeXml(label)}</text>
    <text x="360" y="${y}" fill="${TEXT_PRIMARY}" font-size="14" font-weight="600">${escapeXml(String(value))}</text>`;
  })
  .join("");

const barWidth = 260;
const languageRows = topLanguages.length
  ? topLanguages
      .map(({ name, percent }, index) => {
        const y = 98 + index * 32;
        const filled = Math.max(2, Math.round((percent / 100) * barWidth));
        const opacity = (1 - index * 0.14).toFixed(2);
        return `
    <text x="640" y="${y}" fill="${TEXT_SECONDARY}" font-size="14">${escapeXml(short(name, 14))}</text>
    <rect x="840" y="${y - 12}" width="${barWidth}" height="4" rx="2" fill="${DIVIDER}"/>
    <rect x="840" y="${y - 12}" width="${filled}" height="4" rx="2" fill="${TEXT_PRIMARY}" opacity="${opacity}"/>
    <text x="1168" y="${y}" text-anchor="end" fill="${TEXT_SECONDARY}" font-size="13">${percent.toFixed(1)}%</text>`;
      })
      .join("")
  : `<text x="640" y="98" fill="${TEXT_SECONDARY}" font-size="14">no public language data</text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="280" viewBox="0 0 1200 280" role="img" aria-labelledby="title desc">
  <title id="title">GitHub statistics for ${escapeXml(user)}</title>
  <desc id="desc">Public repositories, followers, stars, forks, latest push and top languages.</desc>
  <rect x="1" y="1" width="1198" height="278" rx="10" fill="#0b0b0d" stroke="#26262a" stroke-width="1"/>
  <g font-family="${FONT}">
    <text x="32" y="40" fill="${TEXT_LABEL}" font-size="12" font-weight="600" letter-spacing="2">GITHUB</text>
    <line x1="32" y1="54" x2="1168" y2="54" stroke="${DIVIDER}" stroke-width="1"/>
${statLines}
${languageRows}
    <line x1="32" y1="238" x2="1168" y2="238" stroke="${DIVIDER}" stroke-width="1"/>
    <text x="32" y="262" fill="${TEXT_LABEL}" font-size="12">Public data · updated daily · ${timestamp()} MSK</text>
  </g>
</svg>
`;

await mkdir("profile", { recursive: true });
await writeFile("profile/github-stats.svg", svg, "utf8");
console.log(`Generated GitHub stats for ${user}`);
