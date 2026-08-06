const path = require("path");
const fs = require("fs");
const express = require("express");

let mediaServer = null;

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg") return "audio/ogg";
  return "application/octet-stream";
}

function resolveMediaRoot({ isPackaged, resourcesPath, appDir }) {
  if (!isPackaged) {
    const devCandidates = [
      path.join(appDir, "..", "public"),
      path.join(appDir, "public"),
    ];
    const found = devCandidates.find((candidate) => fs.existsSync(candidate));
    return found || devCandidates[1];
  }

  const prodCandidates = [
    path.join(resourcesPath, "public"),
    path.join(resourcesPath, "app.asar", "public"),
    path.join(resourcesPath, "app", "public"),
  ];
  const found = prodCandidates.find((candidate) => fs.existsSync(candidate));
  return found || prodCandidates[0];
}

function startMediaServer({ isPackaged, resourcesPath, appDir }) {
  if (mediaServer) return mediaServer;

  const app = express();
  const port = Number(process.env.MEDIA_SERVER_PORT || 3000);
  const mediaRoot = resolveMediaRoot({ isPackaged, resourcesPath, appDir });

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
    res.setHeader("Accept-Ranges", "bytes");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(
    "/songs",
    express.static(path.join(mediaRoot, "songs"), {
      acceptRanges: true,
      maxAge: 0,
      setHeaders: (res, filePath) => {
        res.setHeader("Content-Type", getMimeType(filePath));
        res.setHeader("Accept-Ranges", "bytes");
      },
    })
  );

  app.use(
    "/videos",
    express.static(path.join(mediaRoot, "videos"), {
      acceptRanges: true,
      maxAge: 0,
      setHeaders: (res) => {
        res.setHeader("Accept-Ranges", "bytes");
      },
    })
  );

  mediaServer = app.listen(port, "127.0.0.1", () => {
    console.log(`[media-server] listening on http://127.0.0.1:${port}`);
    console.log(`[media-server] root: ${mediaRoot}`);
  });

  mediaServer.on("error", (error) => {
    console.error("[media-server] failed to start", error);
  });

  return mediaServer;
}

function stopMediaServer() {
  if (!mediaServer) return;
  mediaServer.close();
  mediaServer = null;
}

module.exports = {
  startMediaServer,
  stopMediaServer,
};
