import { describe, it, expect } from 'vitest';
import { findConfigProblem } from '../src/lib/cloudinary.js';

describe('findConfigProblem', () => {
  it('accepts a well-formed url', () => {
    expect(findConfigProblem('cloudinary://123456:abcDEF@mycloud')).toBeNull();
  });

  it('rejects the template placeholders left in place', () => {
    const problem = findConfigProblem('cloudinary://<123456>:<abcDEF>@mycloud');
    expect(problem).toMatch(/parentesi/);
  });

  it('rejects a missing value', () => {
    expect(findConfigProblem('')).toMatch(/mancante/);
    expect(findConfigProblem(null)).toMatch(/mancante/);
  });

  // Senza argomento legge process.env: è la forma usata all'avvio del server.
  it('falls back to the environment', () => {
    expect(process.env.CLOUDINARY_URL).toBeTruthy();
    expect(findConfigProblem()).toBeNull();
  });

  it('rejects a url that is not in cloudinary form', () => {
    expect(findConfigProblem('https://example.com')).toMatch(/forma/);
    expect(findConfigProblem('cloudinary://solo-chiave@mycloud')).toMatch(/forma/);
  });
});
