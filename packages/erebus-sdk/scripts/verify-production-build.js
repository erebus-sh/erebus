#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Script to verify that logger calls are properly stripped from production builds
 * Run this after building the SDK with NODE_ENV=production
 */

const DIST_DIR = path.join(__dirname, '..', 'dist');
const LOG_PATTERNS = [
  /logger\.info/g,
  /logger\.warn/g,
  /logger\.error/g,
  /logger\.debug/g,
  /logger\.trace/g,
  /logger\.success/g,
  /logger\.fail/g,
  /logger\.ready/g,
  /logger\.start/g,
  /logger\.log/g,
  /consolaInstance/g,
  /createConsola/g,
];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const results = [];
  
  for (const pattern of LOG_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      results.push({
        pattern: pattern.source,
        count: matches.length,
        positions: getMatchPositions(content, pattern)
      });
    }
  }
  
  return results;
}

function getMatchPositions(content, pattern) {
  const positions = [];
  let match;
  const regex = new RegExp(pattern.source, 'g');
  
  while ((match = regex.exec(content)) !== null) {
    const line = content.substring(0, match.index).split('\n').length;
    positions.push({ line, match: match[0] });
  }
  
  return positions;
}

function findJSFiles(dir) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    console.log(`❌ Build directory not found: ${dir}`);
    console.log('Run: NODE_ENV=production npm run build first');
    process.exit(1);
  }
  
  function walk(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (item.endsWith('.js') || item.endsWith('.mjs')) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

function main() {
  console.log('🔍 Verifying production build for logger stripping...\n');
  
  const jsFiles = findJSFiles(DIST_DIR);
  console.log(`Found ${jsFiles.length} JavaScript files to check\n`);
  
  let totalIssues = 0;
  
  for (const filePath of jsFiles) {
    const relativePath = path.relative(DIST_DIR, filePath);
    const issues = checkFile(filePath);
    
    if (issues.length > 0) {
      console.log(`⚠️  ${relativePath}:`);
      for (const issue of issues) {
        console.log(`   ${issue.pattern} found ${issue.count} time(s)`);
        for (const pos of issue.positions.slice(0, 3)) { // Show first 3 occurrences
          console.log(`     Line ${pos.line}: ${pos.match}`);
        }
        if (issue.positions.length > 3) {
          console.log(`     ... and ${issue.positions.length - 3} more`);
        }
      }
      console.log();
      totalIssues += issues.reduce((sum, issue) => sum + issue.count, 0);
    }
  }
  
  if (totalIssues === 0) {
    console.log('✅ SUCCESS: No logger calls found in production build!');
    console.log('🎉 All logger calls were properly stripped.');
  } else {
    console.log(`❌ FAILURE: Found ${totalIssues} logger call(s) in production build!`);
    console.log('💡 Check your build configuration and ensure:');
    console.log('   1. NODE_ENV=production is set during build');
    console.log('   2. The strip plugin is working correctly');
    console.log('   3. Tree-shaking is enabled');
    process.exit(1);
  }
}

main();
