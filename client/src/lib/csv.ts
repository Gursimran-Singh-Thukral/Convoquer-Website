export type ImportRow = {
  name: string;
  college: string;
  rollNumber: string;
  sport?: string;
  team?: string;
  gender?: string;
  contactNumber?: string;
  role?: string;
  category?: string;
};

/** Google Sheets File > Download > CSV, including quoted commas and newlines. */
function parseRows(input: string, allowed: string[], required: string[]): Record<string, string>[] {
  const records: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  const text = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (!quoted && field) throw new Error('Unexpected quote in CSV field');
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some(Boolean)) records.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field');
  row.push(field.trim());
  if (row.some(Boolean)) records.push(row);
  const headers = records.shift() || [];
  if (new Set(headers).size !== headers.length || headers.some((h) => !allowed.includes(h)))
    throw new Error('CSV has duplicate or unsupported column names');
  if (required.some((h) => !headers.includes(h)))
    throw new Error(`CSV must contain ${required.join(', ')} headers`);
  if (!records.length || records.length > 1000) throw new Error('Upload between 1 and 1000 rows');
  return records.map((values, index) => {
    if (values.length !== headers.length)
      throw new Error(`Row ${index + 2}: column count does not match the header`);
    const result = Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    if (required.some((key) => !result[key]))
      throw new Error(`Row ${index + 2}: ${required.join(', ')} are required`);
    return result;
  });
}

export function parseParticipantCsv(input: string): ImportRow[] {
  return parseRows(
    input,
    [
      'name',
      'college',
      'rollNumber',
      'sport',
      'team',
      'gender',
      'contactNumber',
      'role',
      'category',
    ],
    ['name', 'college', 'rollNumber'],
  ) as ImportRow[];
}
export type VolunteerImportRow = {
  name: string;
  email: string;
  contactNumber?: string;
  department?: string;
  shift?: string;
  venueId?: string;
  venueName?: string;
  status?: string;
};
export function parseVolunteerCsv(input: string): VolunteerImportRow[] {
  return parseRows(
    input,
    ['name', 'email', 'contactNumber', 'department', 'shift', 'venueId', 'venueName', 'status'],
    ['name', 'email'],
  ).map((row) =>
    Object.fromEntries(Object.entries(row).filter(([, value]) => value !== '')),
  ) as VolunteerImportRow[];
}
