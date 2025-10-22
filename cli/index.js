#!/usr/bin/env node
const path = require("path");
const { program } = require("commander");

// Helper to require command modules relative to this file (robust resolution)
const load = (cmd) => require(path.join(__dirname, "commands", cmd));

// init: pass command opts() to the module
program
  .command("init")
  .description("Initialize a new bit repo")
  .option("-p, --path <path>", "repository path", ".bit")
  .option("-b, --branch <name>", "initial branch name")
  .action((...args) => {
    const cmd = args.pop();
    const opts = cmd && typeof cmd.opts === "function" ? cmd.opts() : {};
    return load("init")(opts);
  });

// add: accepts a path or '.'
program
  .command("add <path>")
  .description("Add file(s) to index")
  .action((p) => load("add")(p));

// commit
program
  .command("commit")
  .option("-m, --message <msg>", "Commit message")
  .option("--allow-empty", "Allow empty commits")
  .description("Commit staged changes")
  .action((...args) => {
    const cmd = args.pop();
    const opts = cmd && typeof cmd.opts === "function" ? cmd.opts() : {};
    return load("commit")(opts);
  });

// status
program
  .command("status")
  .description("Show current repo status")
  .action(() => load("status")());

// log
program
  .command("log")
  .description("Show commit history")
  .action(() => load("log")());

// rm
program
  .command("rm <path>")
  .description("Remove file from working tree and index")
  .action((p) => load("rm")(p));

// mv
program
  .command("mv <src> <dst>")
  .description("Move or rename a file and update index")
  .action((src, dst) => load("mv")(src, dst));

// restore
program
  .command("restore <path>")
  .description("Restore file content from the index")
  .action((p) => load("restore")(p));

// diff
program
  .command("diff [path]")
  .description("Show differences between working tree and index")
  .action((p) => load("diff")(p));

// clone
program
  .command("clone <src> <dest>")
  .description("Clone a repository locally")
  .action((src, dest) => load("clone")(src, dest));

// push
program
  .command("push <dest>")
  .description("Push repository objects and refs to a local path")
  .action((dest) => load("push")(dest));

// pull
program
  .command("pull <src>")
  .description("Pull repository objects and refs from a local path")
  .action((src) => load("pull")(src));

// merge
program
  .command("merge <commit>")
  .description("Fast-forward merge to the given commit if possible")
  .action((commit) => load("merge")(commit));

// remote
program
  .command("remote [subcommand] [args...]")
  .description("Manage remote repositories (add, list, get-url)")
  .action((subcommand, args) => load("remote").remote(subcommand, ...args));

// login
program
  .command("login [token]")
  .description("Authenticate with remote repository")
  .action((token) => load("login").login(token));

// whoami
program
  .command("whoami")
  .description("Show current authentication status")
  .action(() => load("login").whoami());

// push-remote
program
  .command("push-remote [remote] [branch]")
  .description("Push commits to a remote repository")
  .action(async (remote, branch) => {
    await load("push-remote").pushRemote(remote, branch);
  });

// pull-remote
program
  .command("pull-remote [remote] [branch]")
  .description("Pull commits from a remote repository")
  .action(async (remote, branch) => {
    await load("pull-remote").pullRemote(remote, branch);
  });

// clone-remote
program
  .command("clone-remote <url> <repoId> [dir]")
  .description("Clone a repository from a remote")
  .action(async (url, repoId, dir) => {
    await load("clone-remote").cloneRemote(url, repoId, dir);
  });

// show help when no command provided
if (process.argv.length <= 2) {
  program.help({ error: false });
}

program.parse(process.argv);
