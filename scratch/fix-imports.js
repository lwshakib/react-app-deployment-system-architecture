import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../apps/server/src');

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            fixImports(fullPath);
        }
    }
}

function fixImports(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    // Match relative imports that don't have an extension
    // Example: import ... from "../logger/winston.logger"
    // Regex: from "((\.\.?\/)+[^"]+)"
    const updatedContent = content.replace(/from "(\.\.?\/[^"]+)"/g, (match, p1) => {
        if (!p1.endsWith('.js') && !p1.endsWith('.ts') && !p1.endsWith('.css') && !p1.endsWith('.json')) {
            return `from "${p1}.js"`;
        }
        return match;
    });

    if (content !== updatedContent) {
        fs.writeFileSync(filePath, updatedContent);
        console.log(`Fixed imports in ${filePath}`);
    }
}

walk(srcDir);
