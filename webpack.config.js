const path = require("path");

module.exports = {
  context: path.resolve(__dirname, "./"),
  target: "webworker",
  mode: "production",
  output: {
    filename: "main.js",
    path: path.resolve(__dirname, "."),
  },
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
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
    ],
  },
};
