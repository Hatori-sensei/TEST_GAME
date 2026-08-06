const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, protocol, net } = require("electron");
const { pathToFileURL } = require("url");
const { startMediaServer, stopMediaServer } = require("./server");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("ignore-gpu-blocklist");

const isDev = !app.isPackaged;
const DIST_DIR = path.join(__dirname, "dist");

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
  {
    scheme: "media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function getMediaRootDir() {
  if (isDev) {
    return path.resolve(app.getAppPath(), "public");
  }

  const candidates = [
    path.resolve(process.resourcesPath, "public"),
    path.resolve(process.resourcesPath, "app.asar", "public"),
    path.resolve(process.resourcesPath, "app", "public"),
    path.resolve(app.getAppPath(), "public"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function resolveMediaRequestToFilePath(requestUrl, mediaRootDir) {
  const parsed = new URL(requestUrl);
  const combined = decodeURIComponent(`${parsed.host}${parsed.pathname || ""}`);
  const normalized = path.posix.normalize(combined).replace(/^\/+/, "");

  if (!normalized || normalized.startsWith("..")) {
    return null;
  }

  const targetPath = path.resolve(mediaRootDir, normalized);
  const rootResolved = path.resolve(mediaRootDir);
  const inRoot =
    targetPath === rootResolved ||
    targetPath.startsWith(`${rootResolved}${path.sep}`);

  if (!inRoot) return null;
  return targetPath;
}

function registerMediaProtocol() {
  const mediaRootDir = getMediaRootDir();

  protocol.registerFileProtocol("media", (request, callback) => {
    try {
      const targetPath = resolveMediaRequestToFilePath(
        request.url,
        mediaRootDir
      );

      if (!targetPath || !fs.existsSync(targetPath)) {
        callback({ error: -6 });
        return;
      }

      callback({ path: targetPath });
    } catch (error) {
      callback({ error: -2 });
    }
  });
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:3000");
  } else {
    win.loadURL("app://./index.html");
  }
}

async function registerAppProtocol() {
  if (isDev) return;

  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    const relativePath = decodeURIComponent(url.pathname).replace(/^\//, "");
    const target = relativePath || "index.html";
    const filePath = path.join(DIST_DIR, target);
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

app.whenReady().then(async () => {
  startMediaServer({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appDir: __dirname,
  });
  await registerAppProtocol();
  registerMediaProtocol();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopMediaServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
