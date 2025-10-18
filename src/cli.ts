#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs-extra";
import path from "path";

export function renderTemplate(raw: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((acc, [key, val]) => acc.replace(new RegExp(`{{${key}}}`, "g"), val), raw);
}

// Helper function
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Template loader
function loadTemplate(fileName: string, replacements: Record<string, string>): string {
  const templatePath = path.join(__dirname, "templates", fileName);
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

    const templates: Record<string, string> = {
      [`${name}.controller.ts`]: loadTemplate(`controller.tpl`, { name, ModelName }),
      [`${name}.middleware.ts`]: loadTemplate(`middleware.tpl`, { name, ModelName }),
      [`${name}.interface.ts`]: loadTemplate(`interface.tpl`, { name, ModelName }),
      [`${name}.model.ts`]: loadTemplate(`model.tpl`, { name, ModelName }),
      [`${name}.routes.ts`]: loadTemplate(`routes.tpl`, { name, ModelName }),
      [`${name}.validation.ts`]: loadTemplate(`validation.tpl`, { name, ModelName }),
    };

    for (const [fileName, content] of Object.entries(templates)) {
      const filePath = path.join(folderPath, fileName);
      if (fs.existsSync(filePath)) {
        console.log(`⚠️ Skipped: ${fileName} already exists.`);
        continue;
      }
      fs.writeFileSync(filePath, content);
      console.log(`✅ Created: ${fileName}`);
    }

    console.log(`🎉 CRUD module "${name}" setup complete at ${folderPath}`);
  });

program.parse(process.argv);
