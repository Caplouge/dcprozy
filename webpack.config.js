const path = require("path");
const webpack = require("webpack");

module.exports = {
  context: path.resolve(__dirname, "./"),
  target: "webworker",
  mode: "production",
  plugins: [
    new webpack.DefinePlugin({
      CUSTOM_DOMAIN: JSON.stringify(process.env.CUSTOM_DOMAIN || "libcuda.so"),
      MODE: JSON.stringify(process.env.MODE || "production"),
      TARGET_UPSTREAM: JSON.stringify(process.env.TARGET_UPSTREAM || ""),
    }),
  ],
  optimization: {
    usedExports: true,
  },
  module: {
    rules: [
      {
        include: /node_modules/,
        test: /\.mjs$/,
        type: "javascript/auto",
      },
    ],
  },
};
