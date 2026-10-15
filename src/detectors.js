/**
 * M.H. AI Sync - Project Stack Auto-Detector
 * Automatically inspects the repository root to discover languages, package managers,
 * frameworks, and execution commands.
 */

const fs = require('fs');
const path = require('path');

function detectStack(rootDir = process.cwd()) {
  const result = {
    name: path.basename(rootDir) || "AI-Augmented Project",
    overview: "Multi-agent context-aware codebase configured via M.H. AI Sync.",
    techStack: [],
    architecture: "Modular architecture with multi-agent context synchronization.",
    commands: {}
  };

  // 1. Check Node.js / JavaScript / TypeScript
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) result.name = pkg.name;
      if (pkg.description) result.overview = pkg.description;

      // Determine package manager
      let pm = 'npm';
      if (fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml'))) pm = 'pnpm';
      else if (fs.existsSync(path.join(rootDir, 'yarn.lock'))) pm = 'yarn';
      else if (fs.existsSync(path.join(rootDir, 'bun.lockb')) || fs.existsSync(path.join(rootDir, 'bun.lock'))) pm = 'bun';

      // Detect TypeScript
      const isTs = fs.existsSync(path.join(rootDir, 'tsconfig.json')) ||
        (pkg.devDependencies && pkg.devDependencies.typescript) ||
        (pkg.dependencies && pkg.dependencies.typescript);

      result.techStack.push(isTs ? 'TypeScript' : 'JavaScript');
      result.techStack.push('Node.js');

      // Detect Frameworks & Libraries
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.next) result.techStack.push('Next.js');
      if (deps['@remix-run/react']) result.techStack.push('Remix');
      if (deps.react) result.techStack.push('React');
      if (deps.vue) result.techStack.push('Vue.js');
      if (deps.svelte) result.techStack.push('Svelte');
      if (deps.express) result.techStack.push('Express');
      if (deps['@nestjs/core']) result.techStack.push('NestJS');
      if (deps.fastify) result.techStack.push('Fastify');
      if (deps.tailwindcss) result.techStack.push('Tailwind CSS');

      // Detect & map commands
      const scripts = pkg.scripts || {};
      result.commands.install = `${pm} install`;
      if (scripts.build) result.commands.build = `${pm} run build`;
      if (scripts.test) result.commands.test = `${pm} test`;
      else result.commands.test = `${pm} test`;
      if (scripts.lint) result.commands.lint = `${pm} run lint`;
      if (scripts.dev) result.commands.dev = `${pm} run dev`;
      else if (scripts.start) result.commands.start = `${pm} start`;
    } catch {
      result.techStack.push('Node.js');
    }
  }

  // 2. Check Python
  const pyprojectPath = path.join(rootDir, 'pyproject.toml');
  const reqsPath = path.join(rootDir, 'requirements.txt');
  const reqsDevPath = path.join(rootDir, 'requirements-dev.txt');
  const pipfilePath = path.join(rootDir, 'Pipfile');
  const setupPyPath = path.join(rootDir, 'setup.py');

  if (fs.existsSync(pyprojectPath) || fs.existsSync(reqsPath) || fs.existsSync(reqsDevPath) || fs.existsSync(pipfilePath) || fs.existsSync(setupPyPath)) {
    result.techStack.push('Python');
    let runner = 'python';

    if (fs.existsSync(pyprojectPath)) {
      try {
        const pyproject = fs.readFileSync(pyprojectPath, 'utf8');
        if (pyproject.includes('[tool.poetry]')) {
          runner = 'poetry run';
          result.commands.install = 'poetry install';
        } else if (pyproject.includes('[tool.uv]') || pyproject.includes('[project]')) {
          runner = 'uv run';
          result.commands.install = 'uv sync';
        }
        if (pyproject.includes('fastapi')) result.techStack.push('FastAPI');
        if (pyproject.includes('django')) result.techStack.push('Django');
        if (pyproject.includes('flask')) result.techStack.push('Flask');
      } catch {
        // Safe fallback
      }
    } else if (fs.existsSync(reqsPath)) {
      result.commands.install = 'pip install -r requirements.txt';
    } else if (fs.existsSync(reqsDevPath)) {
      result.commands.install = 'pip install -r requirements-dev.txt';
    }

    if (!result.commands.test) result.commands.test = `${runner} pytest`.trim();
    if (!result.commands.lint) result.commands.lint = `${runner} ruff check .`.trim();
    if (!result.commands.dev) result.commands.dev = `${runner} python main.py`.trim();
  }

  // 3. Check Rust
  const cargoPath = path.join(rootDir, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    result.techStack.push('Rust');
    try {
      const cargo = fs.readFileSync(cargoPath, 'utf8');
      const nameMatch = cargo.match(/name\s*=\s*"([^"]+)"/);
      if (nameMatch) result.name = nameMatch[1];
    } catch {
      // Safe fallback
    }
    result.commands.build = 'cargo build';
    result.commands.test = 'cargo test';
    result.commands.lint = 'cargo clippy -- -D warnings';
    result.commands.dev = 'cargo run';
  }

  // 4. Check Go
  const goModPath = path.join(rootDir, 'go.mod');
  if (fs.existsSync(goModPath)) {
    result.techStack.push('Go');
    try {
      const goMod = fs.readFileSync(goModPath, 'utf8');
      const modMatch = goMod.match(/module\s+([^\s]+)/);
      if (modMatch) result.name = path.basename(modMatch[1]);
    } catch {
      // Safe fallback
    }
    result.commands.build = 'go build ./...';
    result.commands.test = 'go test ./...';
    result.commands.lint = 'golangci-lint run';
    result.commands.dev = 'go run .';
  }

  // 5. Check Docker
  if (
    fs.existsSync(path.join(rootDir, 'Dockerfile')) ||
    fs.existsSync(path.join(rootDir, 'docker-compose.yml')) ||
    fs.existsSync(path.join(rootDir, 'docker-compose.yaml')) ||
    fs.existsSync(path.join(rootDir, 'compose.yml')) ||
    fs.existsSync(path.join(rootDir, 'compose.yaml'))
  ) {
    result.techStack.push('Docker');
  }

  // Deduplicate and fallback
  result.techStack = [...new Set(result.techStack)];
  if (result.techStack.length === 0) {
    result.techStack = ['Polyglot / Generic Project'];
  }

  // Default fallback commands if none detected
  if (!result.commands.build) result.commands.build = 'echo "Build step"';
  if (!result.commands.test) result.commands.test = 'echo "Test step"';

  return result;
}

module.exports = {
  detectStack
};
