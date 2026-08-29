import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceRoot = join(root, "src");
const forbiddenClasses = [
  "surface-card",
  "surface-card-interactive",
  "field-control",
  "hero-menu-surface",
];
const legacyImports = [
  "@radix-ui/",
  "class-variance-authority",
  "cmdk",
  "embla-carousel-react",
  "input-otp",
  "react-day-picker",
  "react-resizable-panels",
  "sonner",
  "vaul",
];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(path)));
    else if (/\.(tsx|ts|css)$/.test(entry.name)) files.push(path);
  }

  return files;
}

const violations = [];
const sourceFiles = await filesIn(sourceRoot);
const packageJson = JSON.parse(await readFile(join(root, "package.json")));

for (const dependency of legacyImports) {
  const packageNames = Object.keys({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  });
  const isPresent = packageNames.some((name) =>
    dependency.endsWith("/") ? name.startsWith(dependency) : name === dependency,
  );
  if (isPresent) violations.push(`package.json: legacy UI dependency ${dependency}`);
}

for (const path of sourceFiles) {
  const content = await readFile(path, "utf8");
  const file = relative(root, path).replaceAll("\\", "/");

  if (content.includes("@/components/ui") || content.includes("src/components/ui")) {
    violations.push(`${file}: import from src/components/ui`);
  }

  for (const dependency of legacyImports) {
    if (
      new RegExp(
        `(?:from|import\\s*\\(|require\\s*\\()\\s*[\\\"']${dependency.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}`,
      ).test(content)
    ) {
      violations.push(`${file}: legacy UI dependency ${dependency}`);
    }
  }

  for (const className of forbiddenClasses) {
    if (content.includes(className)) violations.push(`${file}: duplicated UI class ${className}`);
  }

  if (!file.endsWith(".tsx")) continue;

  const nativeTags = content.match(/<(button|select|textarea|a|img)\b[\s\S]*?>/g) ?? [];
  for (const tag of nativeTags) {
    violations.push(`${file}: visible native control ${tag.split(/\s|>/, 1)[0]}`);
  }

  const nativeInputs = content.match(/<input\b[\s\S]*?>/g) ?? [];
  for (const input of nativeInputs) {
    const isHiddenFileInput =
      /type\s*=\s*["']file["']/.test(input) &&
      /className\s*=\s*["'][^"']*\b(?:hidden|sr-only)\b/.test(input);
    if (!isHiddenFileInput) violations.push(`${file}: visible native input`);
  }
}

try {
  const legacyDirectory = await stat(join(sourceRoot, "components", "ui"));
  if (legacyDirectory.isDirectory()) {
    violations.push("src/components/ui: legacy component directory still exists");
  }
} catch {
  // The legacy directory is intentionally absent.
}

if (violations.length > 0) {
  console.error("UI audit failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(
    "UI audit passed: active UI uses HeroUI components and approved technical exceptions only.",
  );
}
