const fs = require("fs");
const path = require("path");
const { inRepo } = require("../lib/files");
const {
  getRemote,
  listRemoteRefs,
  headObject,
  putObject,
  updateRemoteRef,
} = require("../lib/remote");
const { getHead, readCommit, getObjectPath } = require("../lib/repo");

/**
 * Push commits to a remote repository
 */
async function pushRemote(remoteName = "origin", branchName = null) {
  try {
    const repoRoot = inRepo();
    const remote = getRemote(remoteName);
    if (!remote) {
      console.error(
        `Remote '${remoteName}' not found. Add it with 'bit remote add'.`
      );
      return;
    }

    // Determine branch to push
    const headPath = path.join(repoRoot, ".bit", "HEAD");
    const headContent = fs.readFileSync(headPath, "utf8").trim();

    let localBranch;
    let localHash;

    if (headContent.startsWith("ref:")) {
      localBranch = headContent.slice(5).trim();
      if (branchName && localBranch !== branchName) {
        console.error(
          `HEAD is at ${localBranch}, but you specified ${branchName}`
        );
        return;
      }
      const refPath = path.join(repoRoot, ".bit", localBranch);
      if (!fs.existsSync(refPath)) {
        console.error("No commits yet. Nothing to push.");
        return;
      }
      localHash = fs.readFileSync(refPath, "utf8").trim();
    } else {
      console.error("Detached HEAD. Cannot push.");
      return;
    }

    console.log(`Pushing ${localBranch} to ${remoteName}...`);

    // Get remote refs
    const remoteRefs = await listRemoteRefs(remote);
    const remoteRef = remoteRefs.find((r) => r.name === localBranch);
    const remoteHash = remoteRef?.hash || null;

    if (localHash === remoteHash) {
      console.log("Everything up-to-date");
      return;
    }

    // Collect all objects to push
    const objectsToPush = [];
    const visited = new Set();

    async function collectObjects(hash) {
      if (!hash || visited.has(hash)) return;
      visited.add(hash);

      // Check if remote already has this object
      const exists = await headObject(remote, hash);
      if (exists) return;

      objectsToPush.push(hash);

      // Read commit and recurse
      try {
        const commit = readCommit(hash);
        if (commit.parent) {
          await collectObjects(commit.parent);
        }
        // Collect tree objects (blobs)
        for (const blobHash of Object.values(commit.tree)) {
          if (!visited.has(blobHash)) {
            visited.add(blobHash);
            const blobExists = await headObject(remote, blobHash);
            if (!blobExists) {
              objectsToPush.push(blobHash);
            }
          }
        }
      } catch (error) {
        // Not a commit, probably a blob
      }
    }

    await collectObjects(localHash);

    if (objectsToPush.length === 0) {
      console.log("No new objects to push");
    } else {
      console.log(`Uploading ${objectsToPush.length} object(s)...`);

      // Upload in reverse order (oldest first)
      for (const hash of objectsToPush.reverse()) {
        const objPath = getObjectPath(hash);
        const data = fs.readFileSync(objPath);
        await putObject(remote, hash, data);
      }
    }

    // Update remote ref with CAS
    console.log(`Updating ref ${localBranch}...`);
    await updateRemoteRef(remote, localBranch, remoteHash, localHash);

    console.log("Push complete!");
  } catch (error) {
    console.error("Push failed:", error.message);
  }
}

module.exports = { pushRemote };
