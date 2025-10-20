const fs = require("fs");
const path = require("path");
const { readIndex, writeIndex } = require("../lib/repo");

// Remove file from working tree and index (like `git rm` basic)
module.exports = function rm(filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("rm: path is required");
  }
  const index = readIndex() || {};
  const rel = filePath.split(path.sep).join("/");

  let changed = false;

  if (index[rel] !== undefined) {
    delete index[rel];
    changed = true;
    console.log(`Removed from index: ${rel}`);
  }

  const abs = path.resolve(process.cwd(), filePath);
  if (fs.existsSync(abs)) {
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      throw new Error(
        "rm: directories not supported in this simple implementation"
      );
    }
    fs.unlinkSync(abs);
    console.log(`Deleted working file: ${rel}`);
    changed = true;
  }

  if (changed) writeIndex(index);
  else console.log("rm: no changes");
};
