// Simple local push: copy .bit from current repo to a target directory
const fs = require("fs");
const path = require("path");

module.exports = function push(destPath) {
  if (!destPath) throw new Error("push: destination path required");
  const srcRepo = path.join(process.cwd(), ".bit");
  if (!fs.existsSync(srcRepo)) throw new Error("push: not a repository");
  const absDest = path.resolve(process.cwd(), destPath);
  const destRepo = path.join(absDest, ".bit");
  if (!fs.existsSync(absDest)) fs.mkdirSync(absDest, { recursive: true });
  fs.cpSync(srcRepo, destRepo, { recursive: true });
  console.log(`Pushed to ${absDest}`);
};
