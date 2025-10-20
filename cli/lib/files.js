"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Simple filesystem helpers used by repo.js
 * - inRepo(): detect repo dir (respects bit_DIR env or defaults to ".bit")
 * - writeFilesFromTree(tree, targetDir): create files/dirs from a JS tree
 */

const REPO_DIR = process.env.bit_DIR || ".bit";

function absRepoPath(...parts) {
  return path.join(process.cwd(), REPO_DIR, ...parts);
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeWriteFileSync(filePath, data) {
  const dir = path.dirname(filePath);
  ensureDirSync(dir);
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    // write Buffer or string
    fs.writeFileSync(tmp, data);
    try {
      fs.chmodSync(tmp, 0o644);
    } catch (_) {}
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch (_) {}
    throw err;
  }
}

/**
 * Return true if current working directory contains a repo dir
 */
function inRepo() {
  const p = path.join(process.cwd(), REPO_DIR);
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch (_) {
    return false;
  }
}

/**
 * Write a tree structure to disk.
 * tree: object where
 *  - string or Buffer values => file contents
 *  - object values => directory (recurse)
 * targetDir: base directory to write into (e.g. process.cwd())
 */
function writeFilesFromTree(tree, targetDir) {
  if (!tree || typeof tree !== "object") {
    throw new TypeError("writeFilesFromTree: tree must be an object");
  }
  if (!targetDir || typeof targetDir !== "string") {
    throw new TypeError("writeFilesFromTree: targetDir must be a path string");
  }

  function writeNode(node, curPath) {
    if (Buffer.isBuffer(node) || typeof node === "string") {
      // write file atomically
      safeWriteFileSync(curPath, node);
      return;
    }

    if (node === null || node === undefined) {
      // treat null/undefined as empty file
      safeWriteFileSync(curPath, "");
      return;
    }

    if (typeof node === "object") {
      // ensure directory exists and recurse
      ensureDirSync(curPath);
      for (const key of Object.keys(node)) {
        const child = node[key];
        writeNode(child, path.join(curPath, key));
      }
      return;
    }

    // fallback: stringify other primitives
    safeWriteFileSync(curPath, String(node));
  }

  for (const key of Object.keys(tree)) {
    writeNode(tree[key], path.join(targetDir, key));
  }
}

module.exports = {
  inRepo,
  writeFilesFromTree,
};
