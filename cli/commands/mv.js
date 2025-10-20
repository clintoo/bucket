const fs = require("fs");
const path = require("path");
const { readIndex, writeIndex } = require("../lib/repo");

// Move/rename a file and update index (like `git mv` basic)
module.exports = function mv(src, dst) {
  if (!src || !dst) throw new Error("mv: source and destination are required");
  const index = readIndex() || {};
  const relSrc = src.split(path.sep).join("/");
  const relDst = dst.split(path.sep).join("/");

  const absSrc = path.resolve(process.cwd(), src);
  const absDst = path.resolve(process.cwd(), dst);

  if (!fs.existsSync(absSrc)) throw new Error(`mv: source not found: ${src}`);
  const st = fs.statSync(absSrc);
  if (!st.isFile()) throw new Error("mv: only regular files supported");

  // Move file on disk
  const dstDir = path.dirname(absDst);
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
  fs.renameSync(absSrc, absDst);

  // Update index: move entry if tracked
  if (index[relSrc] !== undefined) {
    index[relDst] = index[relSrc];
    delete index[relSrc];
  }

  writeIndex(index);
  console.log(`Renamed ${relSrc} -> ${relDst}`);
};
