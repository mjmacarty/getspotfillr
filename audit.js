const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('.next')) {
        results = results.concat(walk(fullPath));
      }
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

const targetDir = './app';
if (!fs.existsSync(targetDir)) {
  console.error("❌ Error: Could not find './app' directory. Make sure you are in your project root!");
  process.exit(1);
}

const files = walk(targetDir);
let output = `# SpotFillr System Audit\n\nGenerated: ${new Date().toISOString().split('T')[0]}\n\n## App Router Structure & Dependencies\n\n`;

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const hasServerAction = content.includes('use server');
  const supabaseMatches = content.match(/\.from\([\"'\`]([^\"'\`]+)[\"'\`]\)/g) || [];
  const tables = [...new Set(supabaseMatches.map(m => m.replace(/\.from\([\"'\`]/, '').replace(/[\"'\`]\)/, '')))];

  output += `### \`${f}\`\n`;
  if (hasServerAction) output += `- ⚡ **Server Actions:** Detected\n`;
  if (tables.length) output += `- 🗄️ **Supabase Tables:** ${tables.join(', ')}\n`;
  output += '\n';
});

fs.writeFileSync('claude.md', output);
console.log('✅ Audit successfully generated and written to claude.md!');