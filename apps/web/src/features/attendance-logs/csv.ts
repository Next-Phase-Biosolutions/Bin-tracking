/**
 * CSV export of one day's log. Opens cleanly in Excel and Sheets, and is safe to open: any cell that begins with a
 * character a spreadsheet would treat as a formula (= + - @, or a tab / carriage return) is prefixed with an
 * apostrophe, so an employee name like "=HYPERLINK(...)" cannot run anything on the manager's computer.
 */

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvField(value: string | number | null | undefined): string {
    let text = value === null || value === undefined ? '' : String(value);
    if (FORMULA_START.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const csvRow = (fields: Array<string | number | null | undefined>) => fields.map(csvField).join(',');

export interface CsvDay {
    date: string;
    timezone: string;
    rows: Array<{
        fullName: string;
        employeeCode: string;
        firstIn: Date;
        lastOut: Date | null;
        lastOutDayOffset: number;
        totalMinutes: number;
        sessionCount: number;
        breakMinutes: number;
        status: string;
    }>;
}

export const STATUS_LABELS: Record<string, string> = {
    COMPLETE: 'Complete',
    IN_PROGRESS: 'Still in',
    OVERDUE: 'Forgotten check-out (open 16 h+)',
    AUTO_CLOSED: 'Auto-closed, not paid until approved',
};

/**
 * One row per employee (the same as the table): first clock-in, last clock-out, total hours as a decimal (8.30) and as
 * minutes (498) so a payroll spreadsheet can use either. Totals are the sum of the counted sessions, as on screen.
 */
export function buildCsv(day: CsvDay, formatClock: (d: Date) => string): string {
    const header = ['Date', 'Employee', 'Employee code', 'First clock in', 'Last clock out', 'Total hours', 'Total minutes', 'Sessions', 'Break minutes', 'Status'];
    const lines = [csvRow(header)];
    for (const r of day.rows) {
        lines.push(
            csvRow([
                day.date,
                r.fullName,
                r.employeeCode,
                formatClock(r.firstIn),
                r.lastOut ? `${formatClock(r.lastOut)}${r.lastOutDayOffset > 0 ? ` (+${r.lastOutDayOffset} day)` : ''}` : '',
                (r.totalMinutes / 60).toFixed(2),
                r.totalMinutes,
                r.sessionCount,
                r.breakMinutes,
                STATUS_LABELS[r.status] ?? r.status,
            ]),
        );
    }
    // The byte-order mark makes Excel read the file as UTF-8, so accented names survive.
    return `﻿${lines.join('\r\n')}\r\n`;
}

/** Triggers a browser download of text as a file. Not exercised in unit tests (needs a real browser). */
export function downloadTextFile(filename: string, text: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
