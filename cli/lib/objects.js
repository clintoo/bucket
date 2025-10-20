"use strict";

/**
 * - Binary-safe: accepts and returns Buffers by default.
 * - Optional Git-style header support (type + size + \0) for interoperability.
 * - Atomic writes: write to a temp file then rename.
 * - Avoids rewriting existing objects.
 * - Basic validation and clearer errors.
 * - Configurable objects dir via bit_DIR environment var or default ".bit".
 *
 * Exports:
 * - hashObject(data, opts) -> hash (hex string)    (sync)
 * - getObject(hash, opts) -> Buffer or string      (sync)
 * - saveObject(data, opts) -> hash                 (sync)  (alias for hashObject)
 * - exists(hash) -> boolean                        (sync)
 *
 * Notes:
 * - Keeps synchronous APIs compatible with the rest of the workspace.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Resolve repository dir to an absolute path so behavior is deterministic.
const bit_DIR = path.resolve(
  process.cwd(),
  process.env.bit_DIR || ".bit"
);
const OBJECTS_DIR = path.join(bit_DIR, "objects");

// Ensure objects dir exists so callers that expect it can rely on its presence.
function ensureTopObjectsDir() {
  if (!fs.existsSync(OBJECTS_DIR)) {
    fs.mkdirSync(OBJECTS_DIR, { recursive: true });
  }
}
ensureTopObjectsDir();

module.exports = {
  hashObject,
  getObject,
  saveObject,
  exists,
  OBJECTS_DIR,
};

/* ---------------------- Helpers ---------------------- */

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function toBufferStrict(data) {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === "string") return Buffer.from(data, "utf8");
  throw new TypeError("objectStore: data must be a Buffer or string");
}

function validateHash(hash) {
  if (
    typeof hash !== "string" ||
    !/^[0-9a-f]+$/i.test(hash) ||
    hash.length < 3
  ) {
    throw new TypeError("objectStore: hash must be a hex string (length >= 3)");
  }
}

function objectPathsFromHash(hash) {
  validateHash(hash);
  const dir = path.join(OBJECTS_DIR, hash.slice(0, 2));
  const file = path.join(dir, hash.slice(2));
  return { dir, file };
}

/* ---------------------- Core API ---------------------- */

/**
 * hashObject(data, opts)
 * - data: Buffer | string
 * - opts: {
 *     gitFormat: boolean (default: false) -- if true, prepends Git header "type size\0" where type is opts.type or 'blob'
 *     type: string (used only when gitFormat true)
 *   }
 *
 * Returns: sha1 hex string.
 *
 * Side effects: writes object file under .bit/objects/xx/yyyy...
 */
function hashObject(data, opts = {}) {
  const buffer = toBufferStrict(data);

  let payload = buffer;
  if (opts.gitFormat) {
    const type = opts.type || "blob";
    const header = Buffer.from(`${type} ${buffer.length}\0`, "utf8");
    payload = Buffer.concat([header, buffer], header.length + buffer.length);
  }

  const hash = crypto.createHash("sha1").update(payload).digest("hex");
  const { dir, file } = objectPathsFromHash(hash);

  ensureDirSync(dir);

  // Avoid rewriting an existing identical file.
  if (fs.existsSync(file)) {
    // file exists; assume same content (sha1 collision extremely unlikely).
    return hash;
  }

  // Atomic write: write to tmp in same directory then rename.
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, payload);
    // Use permissive mode: owner read/write, group/other read (0o644).
    // Some platforms ignore chmod; ignore errors to be portable.
    try {
      fs.chmodSync(tmp, 0o644);
    } catch (_) {}
    fs.renameSync(tmp, file);
  } catch (err) {
    // cleanup tmp if something went wrong
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch (_) {}
    throw err;
  }

  return hash;
}

/**
 * getObject(hash, opts)
 * - opts: { encoding: undefined|string }
 * - If encoding is undefined (default) returns a Buffer.
 * - If encoding is e.g. 'utf8' returns a string.
 *
 * Throws an error with code 'ENOOBJ' when object not found.
 */
function getObject(hash, opts = {}) {
  const { file } = objectPathsFromHash(hash);
  if (!fs.existsSync(file)) {
    const e = new Error(`objectStore: object ${hash} not found`);
    e.code = "ENOOBJ";
    throw e;
  }
  const encoding = opts.encoding;
  if (encoding === undefined) return fs.readFileSync(file); // Buffer
  return fs.readFileSync(file, encoding); // string with encoding
}

/**
 * exists(hash) -> boolean
 */
function exists(hash) {
  try {
    const { file } = objectPathsFromHash(hash);
    return fs.existsSync(file);
  } catch (_) {
    return false;
  }
}

/**
 * saveObject(data, opts) -> alias for hashObject
 */
function saveObject(data, opts = {}) {
  return hashObject(data, opts);
}
