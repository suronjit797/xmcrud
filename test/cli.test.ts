import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

// Runs src/cli.ts through ts-node inside throwaway project folders.

const cliPath = path.join(__dirname, "..", "src", "cli.ts");
const tempDirs: string[] = [];

const makeProject = (withTs: boolean) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xmcrud-cli-"));
  tempDirs.push(dir);
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "demo" }));
  if (withTs) fs.writeFileSync(path.join(dir, "tsconfig.json"), "{}");
  return dir;
};

const runCli = (cwd: string, ...args: string[]) =>
  spawnSync(process.execPath, ["--require", require.resolve("ts-node/register/transpile-only"), cliPath, ...args], {
    cwd,
    encoding: "utf8",
    // use this repo's tsconfig, not the throwaway project's
    env: { ...process.env, TS_NODE_PROJECT: path.join(__dirname, "..", "tsconfig.json") },
  });

after(() => tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

describe("cli", () => {
  it("prints the package version", () => {
    const { version } = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
    const result = runCli(makeProject(false), "--version");
    assert.equal(result.stdout.trim(), version);
  });

  it("generates a TypeScript module", () => {
    const dir = makeProject(true);
    const result = runCli(dir, "add", "orderItem");
    assert.equal(result.status, 0, result.stderr);

    const moduleDir = path.join(dir, "src", "app", "orderItem");
    const files = fs.readdirSync(moduleDir).sort();
    assert.deepEqual(files, [
      "orderItem.controller.ts",
      "orderItem.interface.ts",
      "orderItem.middleware.ts",
      "orderItem.model.ts",
      "orderItem.routes.ts",
      "orderItem.validation.ts",
    ]);

    const routes = fs.readFileSync(path.join(moduleDir, "orderItem.routes.ts"), "utf8");
    assert.match(routes, /mongooseModel: OrderItemModel/);
    assert.match(routes, /const partialFilterItems: string\[\] = \[\];/);
    assert.match(routes, /removeManyPost: \[notFoundMiddleware\]/);
    assert.doesNotMatch(routes, /\{\{/);
  });

  it("generates a JavaScript module without an interface", () => {
    const dir = makeProject(false);
    assert.equal(runCli(dir, "add", "post").status, 0);
    const files = fs.readdirSync(path.join(dir, "src", "app", "post"));
    assert.ok(files.includes("post.routes.js"));
    assert.ok(!files.some((f) => f.includes("interface")));
  });

  it("does not overwrite existing files", () => {
    const dir = makeProject(true);
    runCli(dir, "add", "user");
    const file = path.join(dir, "src", "app", "user", "user.model.ts");
    fs.writeFileSync(file, "custom");
    const result = runCli(dir, "add", "user");
    assert.match(result.stdout, /Skipped: user.model.ts already exists/);
    assert.equal(fs.readFileSync(file, "utf8"), "custom");
  });

  it("rejects invalid module names", () => {
    for (const name of ["user-profile", "../evil", "1user"]) {
      const dir = makeProject(true);
      const result = runCli(dir, "add", name);
      assert.equal(result.status, 1, name);
      assert.ok(!fs.existsSync(path.join(dir, "src")), name);
    }
  });
});
