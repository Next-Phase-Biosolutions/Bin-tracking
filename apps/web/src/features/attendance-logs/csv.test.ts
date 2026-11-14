import { describe, expect, it } from 'vitest';
import { buildCsv, csvField, csvRow, type CsvDay } from './csv';

describe('csvField', () => {
    it('leaves plain text and numbers alone', () => {
        expect(csvField('Alice Tremblay')).toBe('Alice Tremblay');
        expect(csvField(498)).toBe('498');
        expect(csvField(null)).toBe('');
        expect(csvField(undefined)).toBe('');
    });

    it('quotes a field with a comma, a quote or a line break, doubling inner quotes', () => {
        expect(csvField('Lee, Sam')).toBe('"Lee, Sam"');
        expect(csvField('Sam "SJ" Lee')).toBe('"Sam ""SJ"" Lee"');
        expect(csvField('a\nb')).toBe('"a\nb"');
        expect(csvField('a\r\nb')).toBe('"a\r\nb"');
    });

    it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tcmd', '\rcmd', '=HYPERLINK("http://evil.test","x")'])('neutralises the spreadsheet formula %j with a leading apostrophe', (value) => {
        const out = csvField(value);

        expect(out.replace(/^"/, '').startsWith("'")).toBe(true);
    });

    it('does not touch a hyphen or sign in the middle of text', () => {
        expect(csvField('Jean-Luc')).toBe('Jean-Luc');
        expect(csvField('A=B')).toBe('A=B');
    });
});

describe('buildCsv', () => {
    const clock = (d: Date) => `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    const day: CsvDay = {
        date: '2026-01-14',
        timezone: 'America/Toronto',
        rows: [
            { fullName: 'Alice Tremblay', employeeCode: 'EMP-1', firstIn: new Date('2026-01-14T13:55:00Z'), lastOut: new Date('2026-01-14T22:03:00Z'), lastOutDayOffset: 0, totalMinutes: 488, sessionCount: 1, breakMinutes: 0, status: 'COMPLETE' },
            { fullName: 'Evan Park', employeeCode: 'EMP-5', firstIn: new Date('2026-01-15T03:05:00Z'), lastOut: new Date('2026-01-15T11:10:00Z'), lastOutDayOffset: 1, totalMinutes: 485, sessionCount: 1, breakMinutes: 0, status: 'COMPLETE' },
            { fullName: 'Carol Singh', employeeCode: 'EMP-3', firstIn: new Date('2026-01-14T14:02:00Z'), lastOut: null, lastOutDayOffset: 0, totalMinutes: 0, sessionCount: 1, breakMinutes: 0, status: 'IN_PROGRESS' },
            { fullName: 'Bob Okafor', employeeCode: 'EMP-2', firstIn: new Date('2026-01-14T12:58:00Z'), lastOut: new Date('2026-01-14T22:01:00Z'), lastOutDayOffset: 0, totalMinutes: 498, sessionCount: 2, breakMinutes: 45, status: 'COMPLETE' },
        ],
    };

    it('has a header and one line per employee, with Windows line endings and a byte-order mark for Excel', () => {
        const csv = buildCsv(day, clock);
        const lines = csv.replace(/^﻿/, '').split('\r\n').filter(Boolean);

        expect(csv.startsWith('﻿')).toBe(true);
        expect(lines).toHaveLength(5);
        expect(lines[0]).toBe('Date,Employee,Employee code,First clock in,Last clock out,Total hours,Total minutes,Sessions,Break minutes,Status');
    });

    it('writes total hours as a decimal and as minutes (8h 18m = 8.30 and 498)', () => {
        const bob = buildCsv(day, clock).split('\r\n').find((l) => l.includes('Bob'))!;

        expect(bob).toContain(',8.30,498,2,45,Complete');
    });

    it('marks an overnight clock-out, leaves the clock-out blank while still in, and labels the status', () => {
        const lines = buildCsv(day, clock).split('\r\n');

        expect(lines.find((l) => l.includes('Evan'))).toContain('(+1 day)');
        expect(lines.find((l) => l.includes('Carol'))).toContain(',,0.00,0,1,0,Still in');
    });

    it('an employee called =HYPERLINK(...) cannot become a formula in the export', () => {
        const evil: CsvDay = { ...day, rows: [{ ...day.rows[0]!, fullName: '=HYPERLINK("http://evil.test","click")' }] };

        const line = buildCsv(evil, clock).split('\r\n')[1]!;

        expect(line).toContain(`"'=HYPERLINK(""http://evil.test"",""click"")"`);
        expect(line.split(',')[1]!.startsWith('"\'=')).toBe(true);
    });

    it('an empty day is just the header', () => {
        expect(buildCsv({ ...day, rows: [] }, clock).split('\r\n').filter(Boolean)).toHaveLength(1);
    });

    it('csvRow joins escaped fields', () => {
        expect(csvRow(['a', 'b,c', 3])).toBe('a,"b,c",3');
    });
});
