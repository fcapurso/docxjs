#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..", "..");
const distPath = path.resolve(projectRoot, "dist", "docx-preview.js");
const testsRoot = __dirname;
const filters = new Set(process.argv.slice(2));
const require = createRequire(import.meta.url);

let jszipPath;
try {
	jszipPath = require.resolve("jszip/dist/jszip.js", { paths: [projectRoot] });
} catch (err) {
	console.error("Unable to resolve jszip/dist/jszip.js. Run `npm install` first.");
	process.exit(1);
}

if (!fs.existsSync(distPath)) {
	console.error("dist/docx-preview.js not found. Run `npm run build` first.");
	process.exit(1);
}

const browser = await puppeteer.launch({ headless: "new" });

try {
	const page = await browser.newPage();
	await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
	await page.setContent("<!DOCTYPE html><html><head></head><body></body></html>", { waitUntil: "domcontentloaded" });
	await page.addScriptTag({ path: jszipPath });
	await page.addScriptTag({ path: distPath });

	const entries = fs.readdirSync(testsRoot, { withFileTypes: true })
		.filter(dirent => dirent.isDirectory());

	for (const entry of entries) {
		const name = entry.name;

		if (filters.size > 0 && !filters.has(name)) {
			continue;
		}

		const docxPath = path.join(testsRoot, name, "document.docx");
		const htmlPath = path.join(testsRoot, name, "result.html");

		if (!fs.existsSync(docxPath)) {
			continue;
		}

		console.log(`Generating fixture for ${name}...`);

		const buffer = await fs.promises.readFile(docxPath);
		const base64 = buffer.toString("base64");

		try {
			const html = await page.evaluate(async ({ base64 }) => {
				const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
				const blob = new Blob([binary], {
					type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
				});

				document.body.innerHTML = "";
				const container = document.createElement("div");
				document.body.appendChild(container);

				await docx.renderAsync(blob, container);

				return container.innerHTML;
			}, { base64 });

			const canonical = canonicalise(html);
			await fs.promises.writeFile(htmlPath, canonical, "utf8");
			console.log(`  wrote ${htmlPath}`);
		} catch (err) {
			console.error(`  failed for ${name}:`, err);
		}
	}
} finally {
	await browser.close();
}

function canonicalise(html) {
	return html.replace(/blob:[^"']+/ig, "blob:uri");
}


