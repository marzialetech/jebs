#!/usr/bin/env node
/**
 * Process New York Pizzeria logo: clean white outline of "NEW YORK PIZZERIA" text
 * and the checkered awning roof. Uses separate extraction for text vs awning.
 * Requires: ImageMagick (magick), potrace.
 * Run: node build-nypizza-logo.cjs [source.png]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const scriptDir = path.resolve(__dirname);
const repoRoot = path.join(scriptDir, '..');
const assetsDir = path.join(repoRoot, 'assets');

const defaultSource = path.join(assetsDir, 'logo.png');
const sourceArg = process.argv[2] || defaultSource;

const cursorAssets = path.join(process.env.HOME || '', '.cursor', 'projects', 'Users-jjmarzia-nypizza', 'assets');
const sourcePath = fs.existsSync(sourceArg)
  ? path.resolve(sourceArg)
  : path.join(cursorAssets, path.basename(sourceArg));

if (!fs.existsSync(sourcePath)) {
  console.error('Source not found:', sourcePath);
  process.exit(1);
}

const pbmPath = path.join(scriptDir, '_tmp_nypizza.pbm');
const textMaskPath = path.join(scriptDir, '_tmp_text_mask.png');
const awningMaskPath = path.join(scriptDir, '_tmp_awning_mask.png');
const textOutlinePath = path.join(scriptDir, '_tmp_text_outline.png');
const awningOutlinePath = path.join(scriptDir, '_tmp_awning_outline.png');
const textSvgPath = path.join(scriptDir, '_tmp_text.svg');
const awningSvgPath = path.join(scriptDir, '_tmp_awning.svg');

const outlineWhiteSvg = path.join(assetsDir, 'logo-outline-white.svg');

// Colors from logo
const RED = '#c41e3a';
const CREAM = '#f5f0e8';
const GREEN = '#2d5c2e';
const FUZZ = 25;

// Potrace: high turdsize to suppress small speckles, alphamax for smoother corners
const POTRACE_OPTS = '-t 100 -a 2';

// 1. Extract TEXT mask (red "NEW YORK PIZZERIA" only) - slight dilate for cleaner outline
console.log('1. Extracting text mask (red)...');
execSync(`magick "${sourcePath}" -fuzz ${FUZZ}% -transparent "${RED}" -alpha extract -negate -threshold 25% -morphology Dilate "Diamond:1" "${textMaskPath}"`, { stdio: 'inherit' });

// 2. Extract AWNING mask (top ~40%, green stripes - dilate to merge into one clean shape)
console.log('2. Extracting awning mask (green roof)...');
execSync(`magick "${sourcePath}" -crop 100%x40%+0+0 +repage -fuzz ${FUZZ}% -transparent "${CREAM}" -transparent "${RED}" -alpha extract -threshold 15% -morphology Dilate "Rectangle:20x5" "${awningMaskPath}"`, { stdio: 'inherit' });

// 3. Outline of text
console.log('3. Text outline...');
execSync(`magick "${textMaskPath}" -morphology EdgeOut Diamond -background white -alpha shape -background black -flatten -negate -colorspace gray -threshold 50% "${pbmPath}"`, { stdio: 'inherit' });
execSync(`potrace "${pbmPath}" -s ${POTRACE_OPTS} -o "${textSvgPath}"`, { stdio: 'inherit' });

// 4. Outline of awning
console.log('4. Awning outline...');
execSync(`magick "${awningMaskPath}" -morphology EdgeOut Diamond -background white -alpha shape -background black -flatten -negate -colorspace gray -threshold 50% "${pbmPath}"`, { stdio: 'inherit' });
execSync(`potrace "${pbmPath}" -s ${POTRACE_OPTS} -o "${awningSvgPath}"`, { stdio: 'inherit' });

// 5. Merge SVGs: awning (cropped) + text into one, with correct viewBox
// Get dimensions
const dimOut = execSync(`magick "${sourcePath}" -format "%w %h" info:`, { encoding: 'utf8' }).trim();
const [w, h] = dimOut.split(/\s+/).map(Number);

// Read and parse both SVGs
const textSvg = fs.readFileSync(textSvgPath, 'utf8');
const awningSvg = fs.readFileSync(awningSvgPath, 'utf8');

// Extract path content from each (awning was cropped to 35%, so we need to offset its y)
const awningCropH = Math.round(h * 0.35);
const extractPaths = (svg) => {
  const pathMatch = svg.match(/<g[^>]*>([\s\S]*?)<\/g>/);
  if (!pathMatch) return '';
  return pathMatch[1].replace(/fill="#?[^"]*"/gi, 'fill="#fff"');
};

let textPaths = extractPaths(textSvg);
let awningPaths = extractPaths(awningSvg);

// Awning SVG has viewBox for cropped region; we need to add transform to position it at top
// The awning was cropped from top, so its coordinates are 0,0 in its own space. We wrap it in a g with no transform needed if viewBox is correct.
// Actually the potrace output has its own viewBox. We need to combine into one SVG with viewBox 0 0 w h.
// Simpler: put both <g> contents into one SVG. The text SVG has full viewBox. The awning SVG has viewBox for the cropped 1145x79 region.
// We need to scale and position the awning. The awning SVG viewBox is something like "0 0 1145 79". We need to place it at y=0 in the full 1145x226 viewBox.
// Actually potrace uses pt units. Let me just concatenate the paths and use the full image viewBox. The text paths are in full image coords. The awning paths are in cropped coords (y from 0 to ~79). So we need to add a transform to the awning group: translate(0,0) - actually the awning is already at the top so y coords are 0-79. Good. Both should work in a viewBox of 0 0 1145 226. But the awning SVG might have different units. Let me check the potrace output format.

// Simpler approach: don't crop the awning. Instead, extract green only from the full image. That way both masks are in the same coordinate space. Let me try extracting green from full image - we'll get the awning stripes and the green border. The border might add noise. We could extract green and then crop to top half to remove the border? Or use a different approach: extract green, then use morphology to get just the awning (the top green stripes form a horizontal band).

// Actually let me try without the crop - extract green from full image, use a larger dilate to merge the awning stripes. The green border around the sign might be separate - we could use turdsize to remove it if it's smaller. Or we could try to exclude the bottom portion. Let me try the current approach first and see if the merge works.

// For the merged SVG: we need one SVG with viewBox 0 0 w h. The text paths are in the text SVG's coordinate system. Potrace outputs in pt. The viewBox in potrace output is in pt. So we need to scale. Actually the simplest is to use the same viewBox as the original image. Let me check - potrace -s outputs SVG with dimensions. The dimensions come from the input PBM. So the text outline PBM is full size (1145x226), and the awning outline PBM is cropped (1145x79). So the text SVG has viewBox for full image. The awning SVG has viewBox for 1145x79. To combine: we need to put the awning paths inside a <g transform="translate(0,0)"> (no change) since the awning is at top. The viewBox of the combined SVG should be 0 0 1145 226. The awning paths have y coordinates 0-79 in their space. So they'll appear at the top. Good.

// Extract viewBox from text SVG (full size)
const vbMatch = textSvg.match(/viewBox="([^"]+)"/);
const viewBox = vbMatch ? vbMatch[1] : `0 0 ${w} ${h}`;

// Build combined SVG - use flat structure with both path groups
const combinedSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">
<g fill="#fff" stroke="none">
${awningPaths}
${textPaths}
</g>
</svg>`;

fs.writeFileSync(outlineWhiteSvg, combinedSvg, 'utf8');

// Cleanup
[ pbmPath, textMaskPath, awningMaskPath, textOutlinePath, awningOutlinePath, textSvgPath, awningSvgPath ].forEach(p => {
  if (fs.existsSync(p)) fs.unlinkSync(p);
});

console.log('Done.');
console.log('  White outline:', outlineWhiteSvg);
