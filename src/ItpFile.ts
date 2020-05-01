import readline from 'readline';
import fs from 'fs';
import stream from 'stream';
import LineFileReader from 'line-file-reader';

export type TopologyField = string[];
export type AsyncFile = string | NodeJS.ReadableStream | File;

export class ItpFile {
  protected data: { [itp_field: string]: TopologyField } = {};
  protected _includes: string[] = [];

  static HEADLINE_KEY = '_____begin_____';
  static BLANK_REGEX = /\s+/;

  protected constructor() { }

  /**
   * Read ITPs that can contain multiple `moleculetype` fields.
   * Return one `ItpFile` instance per `moleculetype`.
   */
  static readManyFromString(file: string) {
    let f = new ItpFile;
    let initial = true;
    const files: ItpFile[] = [f];

    let field = ItpFile.HEADLINE_KEY;

    for (const line of file.split('\n')) {
      const new_field = f.readLine(line, field);

      if (new_field) {
        field = new_field;

        // We switch molecule, creating new ITP if not in initial
        if (field === "moleculetype") {
          if (!initial) {
            f = new ItpFile;
            files.push(f);
          }
          else {
            initial = false;
          }
        }
        continue;
      }
    }

    return files;
  }

  /**
   * Read ITPs that can contain multiple `moleculetype` fields.
   * Return one `ItpFile` instance per `moleculetype`.
   */
  static async readMany(file: AsyncFile) {
    const rl = LineFileReader.isFile(file) ? 
      new LineFileReader(file) : 
      readline.createInterface({
        input: typeof file === 'string' ? fs.createReadStream(file) : file,
        crlfDelay: Infinity,
      });

    let f = new ItpFile;
    let initial = true;
    const files: ItpFile[] = [f];

    let field = ItpFile.HEADLINE_KEY;

    for await (const line of rl) {
      const new_field = f.readLine(line, field);

      if (new_field) {
        field = new_field;

        // We switch molecule, creating new ITP if not in initial
        if (field === "moleculetype") {
          if (!initial) {
            f = new ItpFile;
            files.push(f);
          }
          else {
            initial = false;
          }
        }
        continue;
      }
    }

    return files;
  }

  /**
   * Read an raw ITP from a `string`.
   */
  static readFromString(data: string) {
    const f = new ItpFile;
    let field = ItpFile.HEADLINE_KEY;

    for (const line of data.split('\n')) {
      const new_f = f.readLine(line, field);
      if (new_f) {
        field = new_f;
      }
    }

    return f;
  }

  /**
   * Read a raw ITP from a file, stream or `Blob`-like object.
   */
  static async read(file: AsyncFile) {
    const itp = new ItpFile;
    if (!file) {
      throw new Error("You must instanciate ITP file with a stream/path, or specify a stream/path when calling read()");
    }

    const rl = LineFileReader.isFile(file) ? 
      new LineFileReader(file) : 
      readline.createInterface({
        input: typeof file === 'string' ? fs.createReadStream(file) : file,
        crlfDelay: Infinity,
      });

    let field = ItpFile.HEADLINE_KEY;

    for await (const line of rl) {
      const new_f = itp.readLine(line, field);
      if (new_f) {
        field = new_f;
      }
    }

    return itp;
  }

  protected readLine(line: string, current_field: string) {
    const trimmed = line.trim();

    if (!trimmed) {
      return;
    }

    const match = trimmed.match(/^\[ *(\w+) *\]$/);
    if (match) {
      return match[1].trim();
    }

    if (trimmed.startsWith('#include')) {
      this.includes.push(trimmed);
    }

    if (current_field in this.data) 
      this.data[current_field].push(trimmed);
    else
      this.data[current_field] = [trimmed];
  }

  /**
   * Get lines associated to a field.
   */
  getField(name: string, without_comments = false) {
    if (name in this.data) {
      if (without_comments) {
        return this.data[name].filter(e => !e.startsWith(';'));
      }
      return this.data[name];
    }
    return [];
  }

  /**
   * Create/Replace field {name} with lines specified in {data}.
   */
  setField(name: string, data: string[]) {
    this.data[name] = data;
  }

  /**
   * Remove field {name}.
   */
  removeField(name: string) {
    delete this.data[name];
  }

  hasField(name: string) {
    return name in this.data;
  }

  /**
   * If field {name} exists, append lines in {append_data} to registred lines.
   * Otherwise, create the field with specified data.
   */
  appendField(name: string, append_data: string[]) {
    if (name in this.data)
      this.data[name].push(...append_data);
    this.data[name] = append_data;
  }

  /**
   * Lines of ITP before seen one field name.
   */
  get headlines() {
    return this.getField(ItpFile.HEADLINE_KEY);
  }

  /**
   * Name and molecule count specified in `moleculetype` field.
   */
  get name_and_count() {
    const f = this.getField('moleculetype', true);

    if (!f.length) {
      return ["", 0];
    }

    const [name, count] = f[0].split(ItpFile.BLANK_REGEX);
    let n = Number(count);

    return [name, n];
  }

  /**
   * Name specified in `moleculetype` field.
   */
  get name() {
    return this.name_and_count[0];
  }

  /**
   * Count specified in `moleculetype` field.
   */
  get molecule_count() {
    return this.name_and_count[1];
  }

  /**
   * Shortcut to field `atoms`.
   */
  get atoms() {
    return this.getField('atoms');
  }

  /**
   * Shortcut to field `bonds`.
   */
  get bonds() {
    return this.getField('bonds');
  }

  /**
   * Shortcut to field `virtual_sitesn`.
   */
  get virtual_sites() {
    return this.getField('virtual_sitesn');
  }

  /**
   * Lines that begins by `#include` in the ITP file.
   */
  get includes() {
    return this._includes;
  }

  /**
   * Parsed `#include` lines in order to extract specified path.
   */
  get included_files() {
    return this.includes.map(e => e.split('\"')[1]);
  }

  /**
   * Emit a string representation of this ITP as a ReadableStream.
   */
  asReadStream() {
    const stm = new stream.Readable;

    setTimeout(async () => {
      for (const field in this.data) {
        if (field !== ItpFile.HEADLINE_KEY)
          stm.push(`[${field}]\n`);
  
        for (const line of this.data[field]) {
          stm.push(line + '\n');
        }

        await new Promise(resolve => setTimeout(resolve, 5));
      }

      stm.push(null);
    }, 5);

    return stm;
  }

  /**
   * Emit a string representation of this ITP as plain string.
   */
  toString() {
    let str = "";
    for (const field in this.data) {
      if (field !== ItpFile.HEADLINE_KEY)
        str += `[${field}]\n`;

      for (const line of this.data[field]) {
        str += line + '\n';
      }
    }

    return str;
  }

  /**
   * Remove data from this ITP. You can't read it after this!
   */
  dispose() {
    this.data = {};
    this._includes = [];
  }
}

export default ItpFile;
