import { BadRequestException } from '@nestjs/common';

export function csvRecords(input: string): Record<string, string>[] {
  const records: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  const text = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some(Boolean)) records.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (quoted) throw new BadRequestException('Unclosed quoted CSV field');
  row.push(field.trim());
  if (row.some(Boolean)) records.push(row);
  const headers = records.shift() || [];
  const allowed = [
    'name',
    'email',
    'contactNumber',
    'department',
    'shift',
    'venueId',
    'venueName',
    'status',
  ];
  if (
    !headers.includes('name') ||
    !headers.includes('email') ||
    new Set(headers).size !== headers.length ||
    headers.some((h) => !allowed.includes(h))
  )
    throw new BadRequestException(
      'Use name and email headers, plus supported volunteer columns',
    );
  if (!records.length || records.length > 1000)
    throw new BadRequestException('Import between 1 and 1000 volunteers');
  return records.map((values, i) => {
    if (values.length !== headers.length)
      throw new BadRequestException(`Row ${i + 2}: wrong number of columns`);
    return Object.fromEntries(
      headers.flatMap((h, n) => (values[n] ? [[h, values[n]]] : [])),
    );
  });
}

export async function readGoogleSheet(sheetUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(sheetUrl);
  } catch {
    throw new BadRequestException('Enter a Google Sheets URL');
  }
  const match = parsed.pathname.match(
    /^\/spreadsheets\/d\/(e\/)?([\w-]+)(?:\/|$)/,
  );
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'docs.google.com' ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    !match
  )
    throw new BadRequestException(
      'Only docs.google.com spreadsheet URLs are supported',
    );
  const gid =
    parsed.searchParams.get('gid') ||
    new URLSearchParams(parsed.hash.slice(1)).get('gid') ||
    '0';
  if (!/^\d+$/.test(gid)) throw new BadRequestException('Invalid sheet tab ID');
  let url = match[1]
    ? `https://docs.google.com/spreadsheets/d/e/${match[2]}/pub?output=csv&gid=${gid}`
    : `https://docs.google.com/spreadsheets/d/${match[2]}/export?format=csv&gid=${gid}`;
  const signal = AbortSignal.timeout(15000);
  try {
    for (let redirects = 0; redirects < 4; redirects++) {
      const response = await fetch(url, { redirect: 'manual', signal });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;
        const next = new URL(location, url);
        if (
          next.protocol !== 'https:' ||
          next.port ||
          next.username ||
          next.password ||
          !(
            next.hostname === 'docs.google.com' ||
            next.hostname.endsWith('.googleusercontent.com')
          )
        )
          break;
        url = next.href;
        continue;
      }
      if (
        !response.ok ||
        response.headers.get('content-type')?.includes('text/html')
      )
        break;
      const reader = response.body?.getReader();
      if (!reader) break;
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 2 * 1024 * 1024) {
          await reader.cancel();
          throw new BadRequestException('Sheet exceeds 2 MB');
        }
        chunks.push(value);
      }
      return csvRecords(Buffer.concat(chunks).toString('utf8'));
    }
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
  }
  throw new BadRequestException(
    'Cannot read this sheet. For private sheets, download the selected tab as CSV and upload it here.',
  );
}
