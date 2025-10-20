// Simple local pull: copy .bit from a source directory into current repo
const fs = require("fs");
const path = require("path");

module.exports = function pull(srcPath) {
  if (!srcPath) throw new Error("pull: source path required");
  const absSrc = path.resolve(process.cwd(), srcPath);
  const srcRepo = path.join(absSrc, ".bit");
  if (!fs.existsSync(srcRepo))
    throw new Error("pull: source is not a repository");
  const destRepo = path.join(process.cwd(), ".bit");
  if (!fs.existsSync(destRepo))
    throw new Error("pull: destination is not a repository");
  fs.cpSync(srcRepo, destRepo, { recursive: true });
  console.log(`Pulled from ${absSrc}`);
};
