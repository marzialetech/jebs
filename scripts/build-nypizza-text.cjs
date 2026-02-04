#!/usr/bin/env node
/**
 * Process "NEW YORK PIZZERIA" text-only image:
 * 1. Make background transparent
 * 2. Potrace white outline of the red text
 * Requires: ImageMagick (magick), potrace.
 * Run: node build-nypizza-text.cjs [source.png]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const scriptDir = path.resolve(__dirname);
const repoRoot = path.join(scriptDir, '..');
const assetsDir = path.join(repoRoot, 'assets');

const defaultSource = path.join(assetsDir, 'logo-text-only.png');
const sourceArg = process.argv[2] || defaultSource;

const sourcePath = fs.existsSync(sourceArg) ? path.resolve(sourceArg) : defaultSource;

if (!fs.existsSync(sourcePath)) {
  console.error('Source not found:', sourcePath);
  process.exit(1);
}

const pbmPath = path.join(scriptDir, '_tmp_text.pbm');
const textMaskPath = path.join(scriptDir, '_tmp_text_mask.png');
const outlinePath = path.join(scriptDir, '_tmp_text_outline.png');
const transparentPng = path.join(assetsDir, 'logo-text-transparent.png');
const outlineWhiteSvg = path.join(assetsDir, 'logo-text-outline-white.svg');

const BLACK = '#000000';
const RED = '#c41e3a';
const FUZZ = 30;

// 1. Make black background transparent → red text on transparent
console.log('1. Making background transparent...');
execSync(`magick "${sourcePath}" -fuzz ${FUZZ}% -transparent "${BLACK}" "${transparentPng}"`, { stdio: 'inherit' });

// 2. Extract red text as mask (white shape on black for potrace input)
console.log('2. Extracting text mask...');
execSync(`magick "${sourcePath}" -fuzz ${FUZZ}% -transparent "${BLACK}" -alpha extract -negate -threshold 20% "${textMaskPath}"`, { stdio: 'inherit' });

// 3. Outline of text (EdgeOut)
console.log('3. Extracting outline...');
execSync(`magick "${textMaskPath}" -morphology EdgeOut Diamond "${outlinePath}"`, { stdio: 'inherit' });

// 4. Potrace to white SVG
console.log('4. Potracing white outline...');
execSync(`magick "${outlinePath}" -background white -alpha shape -background black -flatten -negate -colorspace gray -threshold 50% "${pbmPath}"`, { stdio: 'inherit' });
execSync(`potrace "${pbmPath}" -s -t 20 -a 1.5 -o "${outlineWhiteSvg}"`, { stdio: 'inherit' });

let svg = fs.readFileSync(outlineWhiteSvg, 'utf8');
svg = svg.replace(/fill="#?[^"]*"/gi, 'fill="#fff"');
fs.writeFileSync(outlineWhiteSvg, svg, 'utf8');

// Cleanup
[ pbmPath, textMaskPath, outlinePath ].forEach(p => {
  if (fs.existsSync(p)) fs.unlinkSync(p);
});

console.log('Done.');
console.log('  Transparent PNG:', transparentPng);
console.log('  White outline SVG:', outlineWhiteSvg);
