import fs from "fs-extra";
import path from "path";

const src = path.join(__dirname, "../src/templates");
const dest = path.join(__dirname, "../dist/templates");

fs.copySync(src, dest);
console.log("✅ Templates copied successfully.");