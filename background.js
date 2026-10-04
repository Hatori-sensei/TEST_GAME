const path = require("path");
const fs = require("fs");
const { Readable } = require("stream");
const { app, BrowserWindow, Menu, protocol } = require("electron");

// ---------------------------------------------------------------------------
// Run modes
//   npm run electron:dev   -> loads the webpack dev server (http://localhost:3000)
//   npm run electron:prod  -> loads ./dist, exactly like the packaged exe
//   packaged exe           -> fullscreen kiosk-style window
// Flags: --windowed (no fullscreen), --rp-debug (allow devtools + console logs)
// ---------------------------------------------------------------------------
const ARGS = process.argv.slice(1);
const DEBUG = ARGS.includes("--rp-debug") || !!process.env.RP_DEBUG;
const WINDOWED = ARGS.includes("--windowed") || !!process.env.RP_WINDOWED;
const isDev = !app.isPackaged && !process.env.RP_PROD;
const lockdown = !isDev && !DEBUG;

const DEV_URL = "http://localhost:3000";
const APP_URL = "app://rhythm/";
const DIST_DIR = path.join(app.getAppPath(), "dist");

// Songs/videos live outside the asar (extraResources) so they can be streamed
// and seeked. In dev / electron:prod they are read straight from ./public.
const MEDIA_DIR = app.isPackaged
  ? path.join(process.resourcesPath, "public")
  : path.join(app.getAppPath(), "public");
// /charts/ is served from here too so chart JSON can be swapped in an
// installed copy without rebuilding the app.
const MEDIA_PREFIXES = ["/songs/", "/videos/", "/charts/"];

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
// Some Windows setups (AV/EDR sandbox restrictions) block Chromium's audio
// service utility process from spawning, which silently drops all sound
// (no WASAPI session ever opens, so the app doesn't even show up in the
// Windows volume mixer). Running the audio service unsandboxed avoids that.
app.commandLine.appendSwitch("disable-features", "AudioServiceSandbox");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function mimeOf(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

// Range support is required for <video> seeking and for streaming large media.
function serveFileWithRange(request, filePath) {
  const size = fs.statSync(filePath).size;
  const headers = { "Content-Type": mimeOf(filePath), "Accept-Ranges": "bytes" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");

  if (!range) {
    return new Response(Readable.toWeb(fs.createReadStream(filePath)), {
      status: 200,
      headers: { ...headers, "Content-Length": String(size) },
    });
  }

  let start;
  let end;
  if (range[1] === "" && range[2] !== "") {
    start = Math.max(0, size - parseInt(range[2], 10));
    end = size - 1;
  } else {
    start = range[1] === "" ? 0 : parseInt(range[1], 10);
    end = range[2] === "" ? size - 1 : Math.min(parseInt(range[2], 10), size - 1);
  }

  if (start > end || start >= size) {
    return new Response(null, {
      status: 416,
      headers: { ...headers, "Content-Range": `bytes */${size}` },
    });
  }

  return new Response(Readable.toWeb(fs.createReadStream(filePath, { start, end })), {
    status: 206,
    headers: {
      ...headers,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
    },
  });
}

function registerAppProtocol() {
  protocol.handle("app", async (request) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url).pathname);

      if (MEDIA_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        const mediaPath = path.join(MEDIA_DIR, pathname);
        if (!isInside(MEDIA_DIR, mediaPath) || !fs.existsSync(mediaPath)) {
          return new Response("Not found", { status: 404 });
        }
        return serveFileWithRange(request, mediaPath);
      }

      let filePath = path.join(DIST_DIR, pathname === "/" ? "index.html" : pathname);
      if (!isInside(DIST_DIR, filePath)) {
        return new Response("Forbidden", { status: 403 });
      }
      // History-mode routing: unknown paths (e.g. /menu on reload) get index.html.
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, "index.html");
      }

      const body = await fs.promises.readFile(filePath);
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": mimeOf(filePath) },
      });
    } catch (error) {
      console.error("[app protocol]", request.url, error);
      return new Response("Internal error", { status: 500 });
    }
  });
}

// Keys we don't want a festival visitor to hit by accident.
function shouldBlockKey(input) {
  if (input.type !== "keyDown") return false;
  const key = String(input.key || "").toLowerCase();
  const ctrl = input.control || input.meta;
  if (key === "f5" || key === "f12") return true;
  if (input.alt && (key === "arrowleft" || key === "arrowright")) return true;
  if (ctrl && ["r", "w", "p", "s", "u", "+", "-", "=", "0"].includes(key)) {
    return true;
  }
  if (ctrl && input.shift && ["i", "j", "c", "r"].includes(key)) return true;
  return false;
}

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    show: false,
    fullscreen: !isDev && !WINDOWED,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      autoplayPolicy: "no-user-gesture-required",
      backgroundThrottling: false,
      devTools: !lockdown,
    },
  });

  const wc = mainWindow.webContents;
  mainWindow.once("ready-to-show", () => mainWindow.show());

  wc.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F11") {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
      return;
    }
    if (lockdown && shouldBlockKey(input)) event.preventDefault();
  });

  wc.on("did-finish-load", () => {
    if (lockdown) wc.setVisualZoomLevelLimits(1, 1);
  });

  // Never navigate away from the game or open extra windows.
  wc.setWindowOpenHandler(() => ({ action: "deny" }));
  wc.on("will-navigate", (event, url) => {
    const allowed = url.startsWith("app://") || url.startsWith(DEV_URL);
    if (!allowed) event.preventDefault();
  });

  wc.on("render-process-gone", (_event, details) => {
    console.error("[renderer gone]", details.reason);
    if (details.reason !== "clean-exit") wc.reload();
  });

  if (DEBUG || isDev) {
    wc.on("did-fail-load", (_e, code, desc, url) =>
      console.error("[did-fail-load]", code, desc, url)
    );
    wc.on("console-message", (_e, level, message, line, source) => {
      if (level >= 2) console.log(`[renderer:${level}] ${message} (${source}:${line})`);
    });
  }

  mainWindow.loadURL(isDev ? DEV_URL : APP_URL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    if (!isDev) registerAppProtocol();
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
