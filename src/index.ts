import readline from 'readline';
import fs from 'fs';
import stream from 'stream';

export type TopologyField = string[];

export class ItpFile {
  protected data: { [itp_field: string]: TopologyField } = {};
  protected _includes: string[] = [];

  static HEADLINE_KEY = '_____begin_____';
  static BLANK_REGEX = /\s+/;

  constructor(protected file?: string | NodeJS.ReadableStream) {}

  /**
   * Read ITPs that contains multiple molecules.
   */
  static async readMany(file: string | NodeJS.ReadableStream) {
    const rl = readline.createInterface({
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
            f = new ItpFile("");
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

  static async read(file: string | NodeJS.ReadableStream) {
    const itp = new ItpFile;
    await itp.read(file);

    return itp;
  }

  async read(file?: string | NodeJS.ReadableStream) {
    if (!file) {
      file = this.file;
    }

    if (!file) {
      throw new Error("You must instanciate ITP file with a stream/path, or specify a stream/path when calling read()");
    }

    const rl = readline.createInterface({
      input: typeof file === 'string' ? fs.createReadStream(file) : file,
      crlfDelay: Infinity,
    });

    let field = ItpFile.HEADLINE_KEY;

    for await (const line of rl) {
      const new_f = this.readLine(line, field);
      if (new_f) {
        field = new_f;
      }
    }
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

export type MoleculeDefinition = { itp: ItpFile, count: number, };

export class TopFile extends ItpFile {
  public readonly molecules: [string, MoleculeDefinition][] = [];

  constructor(
    protected top_file: string | NodeJS.ReadableStream,
    protected itp_files: (string | NodeJS.ReadableStream)[] = [],
    public allow_system_moleculetype_only = true,
  ) {
    super(top_file);
  }

  async read() {
    await super.read();

    const { molecules_count } = TopFile.initItpData(this);

    for (const file of this.itp_files) {
      // Multiple molecules per ITP allowed
      const itps = await ItpFile.readMany(file);
      
      for (const itp of itps) {
        TopFile.registerItp(this, itp, molecules_count);
      }
    }
  }

  protected static initItpData(instance: TopFile) {
    const molecules = instance.getField('molecules');
    const molecules_count: { [name: string]: number } = {};

    for (const line of molecules) {
      const [name, count] = line.split(TopFile.BLANK_REGEX);
      molecules_count[name] = Number(count);

      // register in the case that moleculetype does not exists
      instance.molecules.push([
        name, 
        // @ts-ignore
        { itp: null, count: Number(count) }
      ]);
    }

    return { instance, molecules_count };
  }

  protected static registerItp(instance: TopFile, itp: ItpFile, molecules_count: { [name: string]: number }) {
    const name = itp.name;
    
    if (!(name in molecules_count)) {
      // this molecule is not in the system
      return;
    }
    
    for (const mol of instance.molecules.filter(e => e[0] === name)) {
      mol[1].itp = itp; 
    }
  }

  static readFromString(data: string, itp_data: string[] = []) {
    const f = new TopFile("");
    let field = ItpFile.HEADLINE_KEY;

    for (const line of data.split('\n')) {
      const new_f = f.readLine(line, field);
      if (new_f) {
        field = new_f;
      }
    }

    const { molecules_count } = this.initItpData(f);

    for (const file of itp_data) {
      // Multiple molecules per ITP allowed
      const itp = ItpFile.readFromString(file);
      this.registerItp(f, itp, molecules_count);
    }

    return f;
  }

  getMolecule(name: string) {
    return this.molecules.filter(e => e[0] === name).map(e => e[1]);
  }

  get molecule_list() {
    return this.molecules.map(e => e[1]);
  }

  get system() {
    return this.getField('system');
  }

  /**
   * All includes of TOP file, and all of included ITP files. Remove possible duplicates.
   */
  get nested_includes() {
    const includes = new Set<string>();

    for (const include of this.includes) {
      includes.add(include);
    }

    for (const [, molecule] of this.molecules) {
      for (const include of molecule.itp.includes) {
        includes.add(include);
      }
    }

    return [...includes];
  }

  /**
   * Remove data from all itps included and top file.
   */
  dispose() {
    super.dispose();
    
    for (const [, molecule] of this.molecules) {
      molecule.itp.dispose();
    }
  }
}

export default ItpFile;
