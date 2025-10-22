const { setRemote, getRemote, readConfig } = require("../lib/remote");

/**
 * Manage remote repositories
 */
function remote(subcommand, ...args) {
  if (subcommand === "add") {
    const [name, url, repoId] = args;
    if (!name || !url || !repoId) {
      console.error("Usage: bit remote add <name> <url> <repoId>");
      console.error(
        "Example: bit remote add origin https://xejcpvimktcxcvowbhom.supabase.co/functions/v1/bit-objects abc123"
      );
      return;
    }
    setRemote(name, url, repoId);
    console.log(`Added remote '${name}'`);
  } else if (subcommand === "list" || subcommand === "-v" || !subcommand) {
    const config = readConfig();
    if (!config.remotes || Object.keys(config.remotes).length === 0) {
      console.log("No remotes configured");
      return;
    }
    for (const [name, remote] of Object.entries(config.remotes)) {
      if (subcommand === "-v") {
        console.log(`${name}\t${remote.url} (repo: ${remote.repoId})`);
      } else {
        console.log(name);
      }
    }
  } else if (subcommand === "get-url") {
    const [name] = args;
    if (!name) {
      console.error("Usage: bit remote get-url <name>");
      return;
    }
    const remote = getRemote(name);
    if (!remote) {
      console.error(`Remote '${name}' not found`);
      return;
    }
    console.log(remote.url);
  } else {
    console.error(
      "Usage: bit remote [add <name> <url> <repoId> | list | -v | get-url <name>]"
    );
  }
}

module.exports = { remote };
