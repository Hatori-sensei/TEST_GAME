const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const VueLoaderPlugin = require("vue-loader/lib/plugin");
const CopyPlugin = require("copy-webpack-plugin");
const packageJson = require("./package.json");
const version = packageJson.version || 0; //TODO change to ?? once netlify resolves their issue
const versionPrefix = "alpha";
const commitHash = require("child_process")
  .execSync("git rev-parse --short HEAD")
  .toString()
  .trim();

const isProduction = () => process.env.NODE_ENV === "production";

module.exports = {
  entry: ["babel-polyfill", path.resolve(__dirname, "src", "main.js")],
  mode: isProduction() ? "production" : "development",
  devtool: isProduction() ? false : "source-map",
  resolve: { extensions: ["*", ".js"] },
  // vue-loader 15 + webpack 5 조합에서 .vue의 <style> 블록마다 나는 무해한 경고
  // (export 'default' (imported as 'styleN') was not found). CSS 모듈을 안 쓰므로 무시.
  // 개발 서버의 "Compiled with problems" 오버레이도 이 경고 때문에 떴음.
  ignoreWarnings: [/export 'default' \(imported as 'style\d+'\) was not found/],
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].[contenthash].bundle.js",
    publicPath: "/",
  },
  devServer: {
    static: {
      directory: path.resolve(__dirname, "public"),
    },
    host: "0.0.0.0",
    port: 3000,
    hot: true,
    historyApiFallback: true,
    client: {
      logging: "warn",
    },
  },
  optimization: isProduction()
    ? {
        concatenateModules: true,
        mergeDuplicateChunks: true,
        minimize: true,
        nodeEnv: "production",
        providedExports: true,
        removeAvailableModules: true,
        removeEmptyChunks: true,
        sideEffects: true,
        usedExports: true,
      }
    : {},
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
      {
        test: /\.vue$/,
        loader: "vue-loader",
      },
      {
        test: /\.css$/,
        use: [
          "vue-style-loader",
          {
            loader: "css-loader",
            options: { importLoaders: 1 },
          },
        ],
      },
      {
        test: /\.(png|jpg|gif)$/i,
        use: [
          {
            loader: "url-loader",
            options: {
              limit: 8192,
            },
          },
        ],
      },
      {
        test: /\.less$/,
        use: ["vue-style-loader", "css-loader", "less-loader"],
      },
    ],
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.DefinePlugin({
      "process.env": {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV),
        VERSION_PREFIX: `"${versionPrefix}"`,
        APP_VERSION: `"${version}"`,
        COMMIT_HASH: `"${commitHash}"`,
      },
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "public", "index.html"),
      inject: "body",
    }),
    new VueLoaderPlugin(),
    new CopyPlugin([
      {
        from: path.resolve(__dirname, "public"),
      },
    ]),
  ],
};
