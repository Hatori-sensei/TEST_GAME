const path = require("path");
const express = require("express");

const isElectronBuild =
  process.env.IS_ELECTRON === "true" ||
  process.env.ELECTRON === "true" ||
  (process.env.npm_lifecycle_event || "").startsWith("electron");

module.exports = {
  publicPath: isElectronBuild ? "./" : "/",
  devServer: {
    setupMiddlewares(middlewares, devServer) {
      if (!devServer || !devServer.app) return middlewares;

      devServer.app.use(
        "/songs",
        express.static(path.resolve(__dirname, "public", "songs"))
      );
      devServer.app.use(
        "/videos",
        express.static(path.resolve(__dirname, "public", "videos"))
      );

      return middlewares;
    },
  },
  pluginOptions: {
    electronBuilder: {
      nodeIntegration: true,
      builderOptions: {
        files: ["dist/**/*", "background.js", "public/**/*"],
        extraResources: [
          {
            from: "public/songs",
            to: "public/songs",
            filter: ["**/*"],
          },
          {
            from: "public/videos",
            to: "public/videos",
            filter: ["**/*"],
          },
        ],
        extraMetadata: {
          main: "background.js",
        },
      },
    },
  },
};
