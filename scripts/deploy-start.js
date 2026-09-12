const { execSync } = require("node:child_process");

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

try {
  run("npx prisma db push --skip-generate");
  run("npx tsx prisma/seed.ts");
} catch (err) {
  console.error("No se pudo preparar la base de datos automáticamente:", err.message);
}

require("../server.js");
