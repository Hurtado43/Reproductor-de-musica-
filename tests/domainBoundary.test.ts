import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// El dominio debe ser TypeScript puro: sin React, sin Next.js y sin APIs del navegador.
// La ausencia de tipos del DOM la comprueba además `tsc -p tsconfig.domain.json`.
const domainDir = join(import.meta.dirname, '..', 'src', 'domain');
const files = readdirSync(domainDir).filter((f) => f.endsWith('.ts'));

describe('límite del dominio', () => {
  it('contiene archivos', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s no depende de React, Next.js ni del navegador', (file) => {
    const source = readFileSync(join(domainDir, file), 'utf8');
    expect(source).not.toMatch(/['"]use (client|server)['"]/);
    expect(source).not.toMatch(/from\s+['"](react|react-dom|next)(\/[^'"]*)?['"]/);
    expect(source).not.toMatch(/\.tsx?['"]/); // sin imports de componentes por extensión
    expect(source).not.toMatch(/\b(window|document|localStorage|sessionStorage|navigator|Audio)\b/);
    // Ni archivos ni URLs: el File real vive en la capa cliente (registro de fuentes).
    expect(source).not.toMatch(
      /\b(File|Blob|URL|HTMLAudioElement|HTMLMediaElement|FileReader|AudioContext)\b/,
    );
  });
});
