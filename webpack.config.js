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
};
