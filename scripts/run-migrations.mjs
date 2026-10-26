import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const match = envFile.match(/(?:DATABASE_URL|DATABASE_URL_UNPOOLED)\s*=\s*["']?([^"'\r\n]+)["']?/);
if (!match) {
  console.error("No DATABASE_URL found in .env.local");
  process.exit(1);
}

const sql = neon(match[1]);

function splitSqlStatements(sqlText) {
  const statements = [];
  let current = "";
  let inDollarQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  const lines = sqlText.split("\n");
  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--") && !inDollarQuote) {
      continue; // Skip full comment line
    }

    let i = 0;
    while (i < line.length) {
      // Check block comments
      if (!inDollarQuote && !inLineComment && line.slice(i, i + 2) === "/*") {
        inBlockComment = true;
        i += 2;
        continue;
      }
      if (inBlockComment) {
        if (line.slice(i, i + 2) === "*/") {
          inBlockComment = false;
          i += 2;
        } else {
          i++;
        }
        continue;
      }

      // Check line comment
      if (!inDollarQuote && line.slice(i, i + 2) === "--") {
        break; // Ignore rest of the line
      }

      // Check dollar quoting ($$ or $tag$)
      if (line.slice(i, i + 2) === "$$") {
        inDollarQuote = !inDollarQuote;
        current += "$$";
        i += 2;
        continue;
      }

      // Check statement boundary
      if (line[i] === ";" && !inDollarQuote) {
        const stmt = current.trim();
        if (stmt) {
          statements.push(stmt);
        }
        current = "";
        i++;
        continue;
      }

      current += line[i];
      i++;
    }
    current += "\n";
  }

  const remainder = current.trim();
  if (remainder) {
    statements.push(remainder);
  }

  return statements;
}

async function run() {
  const migrationsDir = path.join(process.cwd(), "scripts", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration files in ${migrationsDir}:`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, "utf8");
    const statements = splitSqlStatements(sqlContent);
    console.log(`\nExecuting migration: ${file} (${statements.length} statements)...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await sql.query(stmt);
        console.log(`  ✓ Statement ${i + 1}/${statements.length} executed`);
      } catch (err) {
        console.error(`  ✗ Statement ${i + 1} failed:\n`, stmt, "\nError:", err);
        process.exit(1);
      }
    }
    console.log(`✓ Migration ${file} completed successfully.`);
  }

  console.log("\n🎉 All 4 migrations applied successfully to Neon Database!");
}

run().catch(console.error);
