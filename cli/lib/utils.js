"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Simple helper utilities for repository filesystem operations used by repo.js
 */

/**
 * Returns true if current working directory contains a repository (REPO_DIR).
 * We hardcode the same repo directory name used by repo.js (".bit").
 */
function inRepo() {
  const repoPath = path.join(process.cwd(), ".bit");
  return fs.existsSync(repoPath) && fs.statSync(repoPath).isDirectory();
}

/**
 * Write a tree of files to disk.
 * - tree: JS object representing files/directories. Values that are strings become file contents.
 * - targetDir: base directory to write into.
 *
 * Examples:
 *  writeFilesFromTree({ ".bit": { HEAD: "ref: refs/heads/main\n", index: "{}\n" } }, process.cwd())
 *  writeFilesFromTree({ "README.md": "# hi\n" }, "/tmp/somewhere")
 */
function writeFilesFromTree(tree, targetDir) {
  if (!tree || typeof tree !== "object") {
    throw new Error("tree must be an object");
  }

  function writeNode(node, curPath) {
    // node is either string (file content) or object (directory)
    if (typeof node === "string") {
      const dir = path.dirname(curPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(curPath, node, "utf8");
      return;
    }

    // object — ensure directory exists and recurse
    if (!fs.existsSync(curPath)) {
      fs.mkdirSync(curPath, { recursive: true });
    }

    for (const key of Object.keys(node)) {
      const child = node[key];
      const childPath = path.join(curPath, key);
      // If child is object and empty, still create directory.
      if (typeof child === "object" && child !== null) {
        writeNode(child, childPath);
      } else {
        writeNode(String(child), childPath);
      }
    }
  }

  // Top-level keys could be filenames or directories; write into targetDir
  for (const key of Object.keys(tree)) {
    const node = tree[key];
    const dest = path.join(targetDir, key);
    writeNode(node, dest);
  }
}

module.exports = {
  inRepo,
  writeFilesFromTree,
};
