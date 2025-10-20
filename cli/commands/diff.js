const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { readIndex } = require("../lib/repo");

function sha1(buf) {
  return crypto.createHash("sha1").update(buf).digest("hex");
}

module.exports = function diff(filePath) {
  const index = readIndex() || {};
  if (!filePath) {
    // show summary of modified files (working vs index)
    const modified = [];
    for (const p of Object.keys(index)) {
      const abs = path.join(process.cwd(), p.split("/").join(path.sep));
      if (!fs.existsSync(abs)) {
        modified.push(`${p}: deleted in working tree`);
      } else {
        const data = fs.readFileSync(abs);
        if (sha1(data) !== index[p]) modified.push(`${p}: modified`);
      }
    }
    if (modified.length === 0) console.log("No differences");
    else modified.forEach((l) => console.log(l));
    return;
  }

  const rel = filePath.split(path.sep).join("/");
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    console.log(`${rel}: deleted in working tree`);
    return;
  }
  const work = fs.readFileSync(abs, "utf8");
  const idxHash = index[rel];
  if (!idxHash) {
    console.log(`${rel}: untracked`);
    return;
  }
  // naive inline diff: just show index vs work content
  console.log(`--- index:${rel}`);
  console.log(`+++ work:${rel}`);
  const workLines = work.split(/\r?\n/);
  // we don't store index content easily here; for a simple view show changed status only
  // For now, indicate changed if hashes differ
  const data = fs.readFileSync(abs);
  if (sha1(data) === idxHash) console.log("(no changes)");
  else console.log("(content differs)");
};
