const fs = require("fs");
const path = require("path");

/**
 * Initialize a minimal bit repository.
 * @param {Object} [opts]
 * @param {string} [opts.path='.bit'] - repository directory
 * @param {string} [opts.branch] - initial branch name (defaults to env bit_INIT_BRANCH or 'main')
 */
module.exports = function init(opts = {}) {
  const repoDir = opts.path || ".bit";
  const initialBranch = opts.branch || process.env.bit_INIT_BRANCH || "main";

  try {
    // If path exists, ensure it's a directory; if it is, treat as reinit and exit.
    if (fs.existsSync(repoDir)) {
      const stat = fs.statSync(repoDir);
      if (!stat.isDirectory()) {
        throw new Error(`${repoDir} exists and is not a directory`);
      }
      console.log("Reinitialized existing repository.");
      return;
    }

    // Create required directories in one go (recursive ensures parent creation).
    fs.mkdirSync(path.join(repoDir, "objects"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, "refs", "heads"), { recursive: true });

    // Write HEAD and index only if they don't already exist to avoid overwriting.
    const headPath = path.join(repoDir, "HEAD");
    if (!fs.existsSync(headPath)) {
      fs.writeFileSync(headPath, `ref: refs/heads/${initialBranch}\n`);
    }

    const indexPath = path.join(repoDir, "index");
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, "{}\n");
    }

    console.log(
      `Initialized empty bit repository in ${path.resolve(repoDir)}.`
    );
  } catch (err) {
    // Print a concise error and rethrow for callers/tests to handle if needed.
    console.error("Failed to initialize repository:", err.message);
    throw err;
  }
};
