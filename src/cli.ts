#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs-extra";
import path from "path";

// check codebase is TS or JS
function isTypeScriptProject(): boolean {
  const tsconfigPath = path.join(process.cwd(), "tsconfig.json");
  return fs.existsSync(tsconfigPath);
}

function hasTypeScriptDependency(): boolean {
  const pkgPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(pkgPath)) return false;
  const pkg = fs.readJsonSync(pkgPath);
  return pkg.devDependencies?.typescript || pkg.dependencies?.typescript;
}

function isTS(): boolean {
  return isTypeScriptProject() || hasTypeScriptDependency();
}

export function renderTemplate(raw: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((acc, [key, val]) => acc.replace(new RegExp(`{{${key}}}`, "g"), val), raw);
}

// Helper function
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Template loader
function loadTemplate(fileName: string, replacements: Record<string, string>, folder: "ts" | "js"): string | null {
  const templatePath = path.join(__dirname, "templates", folder, fileName);

  if (!fs.existsSync(templatePath)) {
    console.warn(`⚠️ Template not found: ${fileName} (${folder})`);
    return null;
  }

  const raw = fs.readFileSync(templatePath, "utf-8");
  return renderTemplate(raw, replacements);
}

// main CLI program
const program = new Command();

// CLI command
program
  .command("add <name>")
  .description("Create a full CRUD module")
  .action((name: string) => {
    const ModelName = capitalize(name);
    const folderPath = path.join(process.cwd(), "src", "app", name);
    fs.ensureDirSync(folderPath);

    const useTS = isTS();
    const ext = useTS ? "ts" : "js";

    console.log(`🚀 Codebase is in ${ext} format`);

    const templates: Record<string, string | null> = {
      [`${name}.controller.${ext}`]: loadTemplate(`controller.tpl`, { name, ModelName }, ext),
      [`${name}.middleware.${ext}`]: loadTemplate(`middleware.tpl`, { name, ModelName }, ext),
      // [`${name}.interface.${ext}`]: loadTemplate(`interface.tpl`, { name, ModelName }, ext),
      [`${name}.model.${ext}`]: loadTemplate(`model.tpl`, { name, ModelName }, ext),
      [`${name}.routes.${ext}`]: loadTemplate(`routes.tpl`, { name, ModelName }, ext),
      [`${name}.validation.${ext}`]: loadTemplate(`validation.tpl`, { name, ModelName }, ext),
    };

    if (useTS) templates[`${name}.interface.ts`] = loadTemplate(`interface.ts.tpl`, { name, ModelName }, ext);

    for (const [fileName, content] of Object.entries(templates)) {
      const filePath = path.join(folderPath, fileName);
      if (fs.existsSync(filePath)) {
        console.log(`⚠️ Skipped: ${fileName} already exists.`);
        continue;
      }
      // fs.writeFileSync(filePath, content);
      if (content) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Created: ${fileName}`);
      } else {
        console.log(`⏭️ Skipped: ${fileName} (no template)`);
      }
    }

    console.log(`🎉 CRUD module "${name}" setup complete at ${folderPath}`);
  });

program.parse(process.argv);
