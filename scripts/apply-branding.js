'use strict';

/**
 * apply-branding.js
 *
 * Replaces the upstream Open Notebook branding with the Office of Equity
 * (University of Colorado) mark. The GUI is served by a Next.js frontend that
 * this repo clones from `lfnovo/open-notebook` rather than forking, so the
 * rebrand is applied as a patch over a copy of that source instead of living in
 * a divergent fork.
 *
 * Two places render the brand, and both live upstream:
 *
 *   frontend/src/components/layout/AppSidebar.tsx  the sidebar mark, left of
 *                                                  the app name
 *   frontend/src/app/favicon.ico                   the browser tab icon
 *
 * Source artwork lives in this repo so the patch is self-contained:
 *
 *   assets/cu-logo.png  the mark, served from the frontend's public/ directory
 *
 * Usage:
 *   node scripts/apply-branding.js --frontend <path-to-frontend-src>
 *
 * The caller (`prepare-runtime.js`) points this at its temp build directory so
 * the upstream clone stays untouched.
 */

const fs = require('fs');
const path = require('path');
const { decodePng, buildIco, fitSquare } = require('./build-icons');
const { arg } = require('./lib/cli');
const { PROJECT_DIR, RUNTIME_DIR } = require('./lib/paths');

const LOGO_SRC = path.join(PROJECT_DIR, 'assets', 'cu-logo.png');

// Favicon frames. Browsers pick 16 for tabs and 32 for hi-density tabs; 48
// covers Windows shortcuts and the bookmark bar.
const FAVICON_SIZES = [16, 32, 48];

// The upstream sidebar mark: three colored pebbles composed in a flex row.
const PEBBLES_BLOCK = `// The tri-hue mark recomposed in the owned palette: fern / gold / teal.
function LogoPebbles({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-[3px]', className)} aria-hidden="true">
      <span className="size-[9px] rounded-[3px] bg-fern" />
      <span className="size-[9px] rounded-[3px] bg-gold" />
      <span className="size-[9px] rounded-[3px] bg-teal" />
    </span>
  )
}`;

// Kept as the same component name and `className` contract so both existing
// call sites keep working unchanged in shape. `alt=""` + aria-hidden because
// the app name next to it already conveys the brand to screen readers.
const BRAND_BLOCK = `// Office of Equity mark. Replaces the upstream pebble trio; the artwork is
// served from public/ so the standalone build needs no import rewriting.
function LogoPebbles({ className }: { className?: string }) {
  return (
    <img
      src="/cu-logo.png"
      alt=""
      aria-hidden="true"
      className={cn('size-[18px] shrink-0 object-contain', className)}
    />
  )
}`;

// The collapsed rail stacks the pebbles vertically; an image ignores that, so
// drop the flex-axis classes and keep only the hover fade.
const PEBBLES_COLLAPSED = `<LogoPebbles className="flex-col gap-[3px] transition-opacity group-hover:opacity-0" />`;
const BRAND_COLLAPSED = `<LogoPebbles className="transition-opacity group-hover:opacity-0" />`;

function patchSidebar(frontendDir) {
  const file = path.join(frontendDir, 'src', 'components', 'layout', 'AppSidebar.tsx');
  if (!fs.existsSync(file)) {
    throw new Error(`Failed to apply branding (AppSidebar.tsx not found at ${file})`);
  }

  const raw = fs.readFileSync(file, 'utf8');
  // The upstream checkout uses CRLF on Windows; compare and patch on LF so the
  // literal blocks below match regardless of how git checked the file out.
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const source = raw.split('\r\n').join('\n');

  if (source.includes(BRAND_BLOCK)) {
    return; // already branded
  }
  if (!source.includes(PEBBLES_BLOCK)) {
    throw new Error(
      'Failed to apply branding (upstream LogoPebbles block not found; the sidebar was likely restructured upstream)'
    );
  }
  let patched = source.replace(PEBBLES_BLOCK, BRAND_BLOCK);

  if (patched.includes(PEBBLES_COLLAPSED)) {
    patched = patched.replace(PEBBLES_COLLAPSED, BRAND_COLLAPSED);
  }

  fs.writeFileSync(file, eol === '\r\n' ? patched.split('\n').join('\r\n') : patched, 'utf8');
}

function writeFavicon(frontendDir, logo) {
  const file = path.join(frontendDir, 'src', 'app', 'favicon.ico');
  if (!fs.existsSync(path.dirname(file))) {
    throw new Error(`Failed to write favicon (src/app directory not found at ${path.dirname(file)})`);
  }
  const icon = buildIco(FAVICON_SIZES.map((size) => fitSquare(logo, size)));
  fs.writeFileSync(file, icon);
}

function applyBranding(frontendDir) {
  if (!fs.existsSync(LOGO_SRC)) {
    throw new Error(`Branding artwork not found: ${LOGO_SRC}`);
  }

  const logo = decodePng(fs.readFileSync(LOGO_SRC));

  const publicDir = path.join(frontendDir, 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  // Next serves public/ verbatim, so this lands at /cu-logo.png. prepare-runtime
  // copies public/ into the assembled runtime alongside the Next build output.
  fs.copyFileSync(LOGO_SRC, path.join(publicDir, 'cu-logo.png'));

  patchSidebar(frontendDir);
  writeFavicon(frontendDir, logo);
}

if (require.main === module) {
  const frontendDir = path.resolve(arg('--frontend', path.join(RUNTIME_DIR, 'frontend')));
  applyBranding(frontendDir);
  console.log(`✅ Applied Office of Equity branding to ${frontendDir}`);
}

module.exports = { applyBranding };
