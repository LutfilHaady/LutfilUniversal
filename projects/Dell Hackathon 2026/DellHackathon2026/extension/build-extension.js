// Simple build script to copy necessary files after Vite build and bundle content script
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Bundle content.js with its chunks into a single IIFE file
const assetsDir = path.join(distDir, 'assets');
const chunksDir = path.join(assetsDir, 'chunks');

if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  const contentFile = files.find((f) => f.startsWith('content') && f.endsWith('.js'));
  
  if (contentFile) {
    let contentCode = fs.readFileSync(path.join(assetsDir, contentFile), 'utf-8');
    
    // Find all chunk imports (handle minified format: import{...}from"...")
    const importRegex = /import\s*\{[^}]*\}\s*from\s*['"]([^'"]+)['"]/g;
    const imports = [];
    let match;
    
    while ((match = importRegex.exec(contentCode)) !== null) {
      const importPath = match[1];
      if (importPath.includes('chunks/') || importPath.startsWith('./chunks/') || importPath.startsWith('../chunks/')) {
        imports.push(importPath);
      }
    }
    
    // Inline all chunks
    if (fs.existsSync(chunksDir)) {
      const chunkFiles = fs.readdirSync(chunksDir);
      
      imports.forEach((importPath) => {
        // Extract chunk name from import path (e.g., "./chunks/client-Cmjl_fXq.js" -> "client-Cmjl_fXq.js")
        const chunkFileName = path.basename(importPath).replace(/['"]/g, '');
        // Find matching chunk file by prefix (before hash)
        const chunkPrefix = chunkFileName.split('-')[0]; // "client"
        const chunkFile = chunkFiles.find((f) => f.startsWith(chunkPrefix));
        
        if (chunkFile) {
          const chunkCode = fs.readFileSync(path.join(chunksDir, chunkFile), 'utf-8');
          // Remove import statement - match minified format: import{...}from"..."
          const escapedPath = importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Match: import{...}from"... or import {...} from "..."
          contentCode = contentCode.replace(
            new RegExp(`import\\s*\\{[^}]*\\}\\s*from\\s*['"]${escapedPath}['"];?`, 'g'),
            ''
          );
          // Prepend chunk code (chunks should come before code that uses them)
          contentCode = chunkCode + '\n' + contentCode;
        } else {
          console.warn(`⚠ Could not find chunk for import: ${importPath}`);
        }
      });
    } else {
      console.warn(`⚠ Chunks directory not found: ${chunksDir}`);
    }
    
    // Fix variable name mappings after inlining chunks
    // The exports are: c=createRoot, j=jsx runtime, r=React
    // But the code uses: c.useState (should be r.useState), e.jsxs (should be j.jsxs), x(t).render (should be c(t).render)
    contentCode = contentCode
      .replace(/\bc\.useState\b/g, 'r.useState')
      .replace(/\be\.jsxs\b/g, 'j.jsxs')
      .replace(/\be\.jsx\b/g, 'j.jsx')
      .replace(/\bx\(/g, 'c(');
    
    // Fix variable shadowing: state variable 'r' conflicts with React import 'r'
    // The minified code has: [r,a]=r.useState(null) which shadows React
    // Strategy: rename state variable 'r' to 'resultState' ONLY in the component code
    // We need to be very careful not to replace 'r' in React library code
    
    // Step 1: Replace destructuring pattern [r,a]=r.useState( with [resultState,a]=r.useState(
    contentCode = contentCode.replace(/\[r,a\]=r\.useState\(/g, '[resultState,a]=r.useState(');
    
    // Step 2: Replace all property accesses on state: r.riskScore, r.sentimentTags
    contentCode = contentCode.replace(/\br\.riskScore\b/g, 'resultState.riskScore');
    contentCode = contentCode.replace(/\br\.sentimentTags\b/g, 'resultState.sentimentTags');
    
    // Step 3: Replace standalone 'r' when used as state variable in component code
    // Only replace in very specific patterns that are unique to our component:
    // - r&&j.jsxs (state check before JSX - this pattern is unique to our component)
    contentCode = contentCode.replace(/\br\&\&j\.jsxs/g, 'resultState&&j.jsxs');
    
    // Remove all export statements (ES module exports are not allowed in IIFE)
    // Match: export{...} or export {...} or export default ...
    contentCode = contentCode.replace(/export\s*\{[^}]*\}\s*;?/g, '');
    contentCode = contentCode.replace(/export\s+default\s+[^;]+;?/g, '');
    contentCode = contentCode.replace(/export\s+\{[^}]*\}\s*;?/g, '');
    
    // Wrap in IIFE to avoid global scope pollution
    const iifeCode = `(function() {\n${contentCode}\n})();`;
    
    // Write bundled content.js to dist root
    fs.writeFileSync(path.join(distDir, 'content.js'), iifeCode);
    console.log('✓ Bundled content.js with all chunks into IIFE');
  }
}

// Copy manifest.json
if (fs.existsSync('manifest.json')) {
  fs.copyFileSync('manifest.json', path.join(distDir, 'manifest.json'));
  console.log('✓ Copied manifest.json');
}

// Copy popup.html
if (fs.existsSync('popup.html')) {
  fs.copyFileSync('popup.html', path.join(distDir, 'popup.html'));
  console.log('✓ Copied popup.html');
}

// Copy icons directory
const iconsSrc = path.join(__dirname, 'public', 'icons');
const iconsDest = path.join(distDir, 'icons');

if (fs.existsSync(iconsSrc)) {
  if (!fs.existsSync(iconsDest)) {
    fs.mkdirSync(iconsDest, { recursive: true });
  }
  const iconFiles = ['icon16.png', 'icon48.png', 'icon128.png'];
  iconFiles.forEach((icon) => {
    const srcPath = path.join(iconsSrc, icon);
    const destPath = path.join(iconsDest, icon);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ Copied ${icon}`);
    } else {
      console.warn(`⚠ Missing icon: ${icon}`);
    }
  });
} else {
  console.warn('⚠ Icons directory not found. Please create icons as per ICONS_README.md');
}

// Copy CSS file if it exists separately
const contentCssSrc = path.join(__dirname, 'src', 'content.css');
const contentCssDest = path.join(distDir, 'content.css');
if (fs.existsSync(contentCssSrc)) {
  fs.copyFileSync(contentCssSrc, contentCssDest);
  console.log('✓ Copied content.css');
}

console.log('\n✓ Build complete! Load the dist/ folder in Chrome as an unpacked extension.');
