import fs from "node:fs";

const log = fs.readFileSync(
  "C:/Users/ankit/.cursor/projects/d-GIT-Shopify-App-Froms-2026/terminals/506956.txt",
  "utf8",
);
const match = log.match(/Using URL: (https:\/\/[a-z0-9-]+\.trycloudflare\.com)/);
if (!match) {
  console.log("NO_TUNNEL");
  process.exit(1);
}
const base = match[1];
console.log("BASE", base);

for (const path of ["/", "/app", "/app/forms"]) {
  const response = await fetch(base + path, { redirect: "manual" });
  const text = await response.text();
  const title = text.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "";
  const hasFormBuilder = /Form Builder|Create form|\/app\/forms/.test(text);
  console.log(
    path,
    response.status,
    response.headers.get("location") ?? "",
    "title=" + title.slice(0, 80),
    "formBuilder=" + hasFormBuilder,
  );
}
