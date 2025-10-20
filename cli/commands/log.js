const path = require("path");

/**
 * Load repo helpers from cli/lib/repo reliably.
 * From this file (cli/commands), the repo helper lives at ../lib/repo
 * (one directory up to `cli` then into `lib`).
 */
function loadRepoHelpers() {
  const p = path.join(__dirname, "..", "lib", "repo");
  try {
    return require(p);
  } catch (err) {
    // Helpful error to debug resolution problems quickly.
    console.error(
      `Failed to load repo helpers from ${p}. Ensure cli/lib/repo.js exists and exports readCommit/getHead.\n` +
        `Original error: ${err.message}`
    );
    throw err;
  }
}

const { readCommit, getHead } = loadRepoHelpers();

/**
 * Show commit history (like `git log`).
 * @param {Object} [opts]
 * @param {number} [opts.limit] - maximum number of commits to show
 */
module.exports = function log(opts = {}) {
  const limit =
    typeof opts.limit === "number" && opts.limit > 0 ? opts.limit : Infinity;

  try {
    let head = getHead();

    // No commits yet
    if (!head) {
      console.log("No commits yet.");
      return;
    }

    const seen = new Set(); // protect against cycles in commit parents
    let count = 0;

    while (head && count < limit) {
      // detect cycles in parent links
      if (seen.has(head)) {
        console.error(
          "warning: detected cycle in commit ancestry; aborting log traversal."
        );
        break;
      }
      seen.add(head);

      let commit;
      try {
        commit = readCommit(head);
      } catch (err) {
        console.error(`warning: failed to read commit ${head}: ${err.message}`);
        break;
      }

      if (!commit) {
        console.error(`warning: commit ${head} not found; stopping.`);
        break;
      }

      // Pretty print commit info
      console.log(`commit ${head}`);
      if (commit.author && commit.author.name) {
        const email = commit.author.email ? ` <${commit.author.email}>` : "";
        console.log(`Author: ${commit.author.name}${email}`);
      }
      const dateStr = commit.timestamp
        ? new Date(commit.timestamp).toString()
        : "Unknown date";
      console.log(`Date:   ${dateStr}`);
      console.log(""); // blank line
      // indent message body for readability
      const message = (commit.message || "")
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n");
      console.log(message + "\n");

      head = commit.parent;
      count++;
    }
  } catch (err) {
    // Top-level guard: report and rethrow so callers/tests can handle if needed
    console.error("Failed to show log:", err.message);
    throw err;
  }
};
