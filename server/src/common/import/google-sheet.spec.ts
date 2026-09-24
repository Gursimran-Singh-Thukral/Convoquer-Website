import { afterEach, describe, expect, it, vi } from 'vitest';
import { csvRecords, readGoogleSheet } from './google-sheet.js';

afterEach(() => vi.unstubAllGlobals());
describe('Volunteer Google Sheets import', () => {
  it('reads quoted names and rejects invalid headers or incomplete records', () => {
    expect(
      csvRecords('\uFEFFname,email\r\n"Doe, Jane",jane@example.test'),
    ).toEqual([{ name: 'Doe, Jane', email: 'jane@example.test' }]);
    expect(() =>
      csvRecords('name,email,password\nA,a@example.test,x'),
    ).toThrow();
    expect(() => csvRecords('name,email\nA')).toThrow();
    expect(() => csvRecords('name,email\n"A,a@example.test')).toThrow();
  });
  it('exports only the selected Google Sheets tab', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('name,email\nJane,jane@example.test'));
    vi.stubGlobal('fetch', fetcher);
    expect(
      await readGoogleSheet(
        'https://docs.google.com/spreadsheets/d/test-sheet/edit#gid=42',
      ),
    ).toHaveLength(1);
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://docs.google.com/spreadsheets/d/test-sheet/export?format=csv&gid=42',
    );
  });
  it('rejects non-Google URLs without making a request', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    for (const url of [
      'http://127.0.0.1/private',
      'https://docs.google.com.evil.test/spreadsheets/d/a',
      'https://user:pass@docs.google.com/spreadsheets/d/a',
    ]) {
      await expect(readGoogleSheet(url)).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not follow private-network redirects or login pages', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/private' },
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      readGoogleSheet('https://docs.google.com/spreadsheets/d/a'),
    ).rejects.toThrow('private sheets');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
