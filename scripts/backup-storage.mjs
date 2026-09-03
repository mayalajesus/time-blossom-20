import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";

const outputRoot = resolve(process.argv[2] || "backup/storage");
const supabaseUrl = process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const buckets = ["avatars", "workspace-logos"];

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function safeOutputPath(bucket, objectPath) {
  const target = resolve(outputRoot, bucket, ...objectPath.split("/"));
  const root = `${resolve(outputRoot, bucket)}${sep}`;
  if (!target.startsWith(root)) throw new Error("Unsafe Storage object path.");
  return target;
}

async function listObjects(bucket, prefix = "") {
  const objects = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) objects.push(path);
      else objects.push(...(await listObjects(bucket, path)));
    }
    if (!data || data.length < 100) break;
  }
  return objects;
}

const manifest = [];
for (const bucket of buckets) {
  for (const objectPath of await listObjects(bucket)) {
    const { data, error } = await client.storage.from(bucket).download(objectPath);
    if (error) throw error;
    const bytes = Buffer.from(await data.arrayBuffer());
    const target = safeOutputPath(bucket, objectPath);
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, bytes);
    manifest.push({
      bucket,
      path: objectPath,
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
}

await mkdir(outputRoot, { recursive: true });
await writeFile(join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Backed up ${manifest.length} private Storage objects.`);
