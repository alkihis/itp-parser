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

  constructor() {}

  /**
   * Read ITPs that contains multiple molecules.
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
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      const match = trimmed.match(/^\[ *(\w+) *\]$/);
      if (match) {
        field = match[1].trim();

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

      if (trimmed.startsWith('#include')) {
        f.includes.push(trimmed);
      }

      if (field in f.data) 
        f.data[field].push(trimmed);
      else
        f.data[field] = [trimmed];
    }

    return files;
  }

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

  getField(name: string) {
    if (name in this.data)
      return this.data[name];
    return [];
  }

  setField(name: string, data: string[]) {
    this.data[name] = data;
  }

  get headlines() {
    return this.getField(ItpFile.HEADLINE_KEY);
  }

  get name_and_count() {
    const f = this.getField('moleculetype');

    if (!f.length) {
      return ["", 0];
    }

    const [name, count] = f[0].split(ItpFile.BLANK_REGEX);
    let n = Number(count);

    return [name, n];
  }

  get name() {
    return this.name_and_count[0];
  }

  get molecule_count() {
    return this.name_and_count[1];
  }

  get atoms() {
    return this.getField('atoms');
  }

  get bonds() {
    return this.getField('bonds');
  }

  get virtual_sites() {
    return this.getField('virtual_sitesn');
  }

  get includes() {
    return this._includes;
  }

  get included_files() {
    return this.includes.map(e => e.split('\"')[1]);
  }

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
