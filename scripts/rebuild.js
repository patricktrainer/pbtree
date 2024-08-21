const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const cliName = Object.keys(packageJson.bin)[0];

console.log('Starting rebuild process...');

try {
  console.log('Unlinking global package...');
  execSync(`npm unlink -g ${packageJson.name}`, { stdio: 'inherit' });
} catch (error) {
  console.log('Package was not linked globally. Continuing...');
}

console.log('Removing node_modules and package-lock.json...');
try {
  fs.rmSync('node_modules', { recursive: true, force: true });
  fs.unlinkSync('package-lock.json');
} catch (error) {
  console.log('Error removing files:', error.message);
}

console.log('Installing dependencies...');
execSync('npm install', { stdio: 'inherit' });

console.log('Building project...');
execSync('npm run build', { stdio: 'inherit' });

console.log('Linking package globally...');
execSync('npm link', { stdio: 'inherit' });

console.log('Rebuild complete!');
console.log(`You can now run your CLI tool using the '${cliName}' command.`);