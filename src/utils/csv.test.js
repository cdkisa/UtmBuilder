import { describe, it, expect } from 'vitest';
import { toCsv, parseCsv } from './csv.js';

const BOM = String.fromCharCode(0xfeff);

describe('toCsv', () => {
  it("writes the first row's keys as the header, then each row in order", () => {
    expect(toCsv([{ a: '1', b: '2' }, { a: '3', b: '4' }])).toBe('a,b\n1,2\n3,4');
  });

  it('quotes a value holding a comma, a quote or a line break, doubling its quotes', () => {
    expect(toCsv([{ v: 'a,b' }, { v: 'say "hi"' }, { v: 'x\ny' }, { v: 'x\ry' }])).toBe(
      'v\n"a,b"\n"say ""hi"""\n"x\ny"\n"x\ry"',
    );
  });

  it('writes null and undefined as empty', () => {
    expect(toCsv([{ a: null, b: undefined, c: 0 }])).toBe('a,b,c\n,,0');
  });

  it('writes nothing for no rows', () => {
    expect(toCsv([])).toBe('');
  });

  it('quotes a value with leading or trailing whitespace', () => {
    expect(toCsv([{ v: ' x' }, { v: 'y ' }])).toBe('v\n" x"\n"y "');
  });
});

describe('parseCsv', () => {
  it('keys each record by its trimmed header', () => {
    expect(parseCsv(' a , b \n1,2')).toEqual([{ a: '1', b: '2' }]);
  });

  it('keeps a comma inside quotes', () => {
    expect(parseCsv('v\n"a,b"')).toEqual([{ v: 'a,b' }]);
  });

  it('reads a doubled quote inside quotes as one quote', () => {
    expect(parseCsv('v\n"say ""hi"""')).toEqual([{ v: 'say "hi"' }]);
  });

  it('keeps a line break inside quotes as part of one record', () => {
    expect(parseCsv('v,w\n"line one\nline two",x')).toEqual([
      { v: 'line one\nline two', w: 'x' },
    ]);
  });

  it('reads CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n3,4\r\n')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('ignores a leading byte-order mark', () => {
    expect(parseCsv(`${BOM}a\n1`)).toEqual([{ a: '1' }]);
  });

  it('ignores blank lines', () => {
    expect(parseCsv('a\n\n1\n\n')).toEqual([{ a: '1' }]);
  });

  it('reads missing cells as empty and ignores extra ones', () => {
    expect(parseCsv('a,b,c\n1\n1,2,3,4')).toEqual([
      { a: '1', b: '', c: '' },
      { a: '1', b: '2', c: '3' },
    ]);
  });

  it('trims unquoted values and keeps quoted ones exactly', () => {
    expect(parseCsv('a,b\n  x  ," y "')).toEqual([{ a: 'x', b: ' y ' }]);
  });

  it('reads a quote in the middle of an unquoted value literally', () => {
    expect(parseCsv('a\nsay "hi"')).toEqual([{ a: 'say "hi"' }]);
  });

  it('runs an unclosed quote to the end of the text', () => {
    expect(parseCsv('a,b\n"open,1\n2')).toEqual([{ a: 'open,1\n2', b: '' }]);
  });

  it('returns no records for a header alone or for nothing', () => {
    expect(parseCsv('a,b')).toEqual([]);
    expect(parseCsv('')).toEqual([]);
  });

  it('reads back exactly what toCsv wrote', () => {
    const rows = [
      { v: 'a,b' },
      { v: 'say "hi"' },
      { v: 'line one\nline two' },
      { v: 'all, "three"\nat once' },
      { v: 'plain' },
      { v: ' padded ' },
    ];

    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
