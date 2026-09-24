import { describe, expect, it } from 'vitest';
import { parseParticipantCsv, parseVolunteerCsv } from '../lib/csv';
describe('Google Sheets CSV import', () => {
  it('preserves quoted commas, escaped quotes, CRLF and a BOM', () => {
    expect(
      parseParticipantCsv(
        '\uFEFFname,college,rollNumber,sport\r\n"Test, Player","Test ""Institute""",R1,Football\r\n',
      ),
    ).toEqual([
      { name: 'Test, Player', college: 'Test "Institute"', rollNumber: 'R1', sport: 'Football' },
    ]);
  });
  it('rejects ambiguous headers, missing identifiers and truncated quoted values', () => {
    expect(() => parseParticipantCsv('name,college,name\nA,B,C')).toThrow('column');
    expect(() => parseParticipantCsv('name,college,rollNumber\nA,B,')).toThrow('required');
    expect(() => parseParticipantCsv('name,college,rollNumber\n"A,B,C')).toThrow('unclosed');
  });
});

describe('Volunteer CSV import', () => {
  it('preserves quoted names and omits blank optional fields on reimport', () => {
    expect(
      parseVolunteerCsv('name,email,department,shift\n"Doe, Jane",jane@example.test,,MORNING'),
    ).toEqual([{ name: 'Doe, Jane', email: 'jane@example.test', shift: 'MORNING' }]);
  });
  it('rejects missing email and unsupported columns before import', () => {
    expect(() => parseVolunteerCsv('name,email\nJane,')).toThrow('required');
    expect(() => parseVolunteerCsv('name,email,password\nJane,jane@example.test,x')).toThrow(
      'column',
    );
  });
});
