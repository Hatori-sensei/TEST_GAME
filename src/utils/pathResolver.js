function isAbsoluteUrl(path) {
  return /^(https?:|file:|data:|blob:|app:|media:)/i.test(path);
}

function normalizePath(rawPath) {
  return String(rawPath || "")
    .trim()
    .replace(/^\.?[\\/]+/, "")
    .replace(/\\/g, "/");
}

export function resolveMediaUrl(rawPath) {
  if (!rawPath) return "";

  const input = String(rawPath).trim();
  if (isAbsoluteUrl(input)) return input;

  const cleanPath = normalizePath(input);
  const isDev = process.env.NODE_ENV === "development";

  if (isDev && typeof window !== "undefined") {
    const port = window.location?.port || 8080;
    return `http://localhost:${port}/${cleanPath}`;
  }

  return `./${cleanPath}`;
}
