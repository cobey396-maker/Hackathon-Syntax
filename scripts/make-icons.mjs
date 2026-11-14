// Rasterises public/favicon.svg into the PNG icons. Run: node scripts/make-icons.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";
const svg = readFileSync("public/favicon.svg");
await sharp(svg, { density: 300 }).resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile("public/favicon-32.png");
const box = Math.round(180 * 0.6); // 20% padding each side
const icon = await sharp(svg, { density: 600 }).resize(box, box, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: "#07182D" } }).composite([{ input: icon, gravity: "centre" }]).png().toFile("public/apple-touch-icon.png");
console.log("icons written");
