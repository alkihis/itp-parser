import LineFileReader from 'line-file-reader';
import readline from 'readline';
import fs from 'fs';
import ItpFile from './ItpFile';
import { MoleculeDefinition } from './TopFile';
import stream from 'stream';
import path from 'path';

enum ConditionalState {
  NotReadable = -1,
  Unvalidated,
  Validated,
  EnteredElse,
};

export interface ReadEntry {
  path: string;
  stream: NodeJS.ReadableStream; 
  content: string;
  file: Blob;
  /** Only valid on return of a `on_include` closure. */
  none: true;
}

type AsyncLineReader = AsyncIterableIterator<string>;
export type Includer = (name: string) => Partial<ReadEntry> | Promise<Partial<ReadEntry>>;


/**
 * Topology parser with include resolver and preprocessor support.
 * 
 * Useful to parse a system and extract data from it.
 * 
 * Beside its "basic" counterpart, it cannot be emitted to string as the same form as the input files.
 * To modify an exisiting system and write it to a file, prefer the basic counterpart.
 */
export class AdvancedTopFile extends ItpFile {
  /* Public fields */

  /** Contain all read ITPs splitted by `moleculetype`, even those present in given TOP file. */
  public readonly registred_itps: Set<ItpFile> = new Set;

  /** List (in the order of the `molecules` field) of the molecules in this system. */
  public readonly molecules: MoleculeDefinition[] = [];


  /* Private fields */

  /** Name of the system. */
  protected _name = "";

  /** Current field during read. */
  protected current_field: string = ItpFile.HEADLINE_KEY;

  /** Current molecule to be filled during read */
  protected current_molecule: ItpFile | undefined | null = null;

  /** Closure called to include a file. Default to return as file path. */
  protected on_include: Includer = path => ({ path });

  /** Defined things */
  protected defines: { [variable: string]: any } = {};

  /** Defined moleculetypes */
  protected molecules_stash: ItpFile[] = [];


  /* Constructor */

  /**
   * Construct a new instance of `AdvancedTopFile`. Does not start read, you must call `.read()`.
   * 
   * @param enable_preprocessors [default = true] Enable preprocessors other than `#include` to be parsed.
   */
  constructor(protected enable_preprocessors = true) { 
    super();
  }


  /* Private methods */

  protected async indexate() {
    const types: { [type: string]: ItpFile } = {};

    for (const mol of this.molecules_stash) {
      types[mol.type] = mol;
    }

    for (const line of this.getField('molecules', true)) {
      const [type, str_count] = line.split(ItpFile.BLANK_REGEX, 2);
      const count = Number(str_count);

      this.molecules.push({
        // @ts-ignore
        itp: types[type] ?? null,
        count,
        type,
      });
    }
  }

  protected async readLinesFrom(reader: AsyncLineReader, filename: string, if_stack: ConditionalState[] = []) { 
    let can_read = true;
    let line_no = 0;
    let start_level = if_stack.length;
    
    for await (const line of reader) {
      line_no++;

      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      // 1- If preprocessor instruction
      if (this.enable_preprocessors && trimmed.startsWith('#')) {
        const result = this.handlePreprocessors(trimmed, if_stack, can_read, line_no, filename);

        if (typeof result === 'boolean') {
          can_read = result;
          continue;
        }
        else if (result === null) {
          continue;
        }
      }

      if (!can_read) {
        // console.log("NOT_READ: ", trimmed)
        // Read disabled by preprocessors
        continue;
      }
      
      if (trimmed.startsWith('#include')) {
        this.includes.push(trimmed);
        const file = trimmed.split('\"')[1];

        const data = await this.on_include(file);
        const reader = this.getLineReader(data);

        if (reader) {
          await this.readLinesFrom(reader, file, if_stack);
        }
        continue;
      }

      // 2- Look for a field.
      const match = trimmed.match(/^\[ *(\w+) *\]$/);

      // 3- If field
      if (match) {
        const cf = match[1].trim();
        this.current_field = cf;

        // 3.1- Check if field is [moleculetype]
        if (cf === "moleculetype") {
          if (this.current_molecule === undefined) {
            throw new Error("You can't described molecules after a system definition.");
          }

          // If so, construct a new IncludedMolecule
          this.current_molecule = new ItpFile;
          this.molecules_stash.push(this.current_molecule);
        }
        // 3.2- Check if field is [system] or [molecules]
        else if (cf === "system" || cf === "molecules") {
          // Molecule read is over
          this.current_molecule = undefined;

          // Next lines will register the system
        }

        // Other wise, this is just a field change
        continue;
      }

      const field = this.current_field;
      const molecule = this.current_molecule;

      if (molecule) {
        // Register molecule data
        molecule.appendFieldLine(field, trimmed);
      }
      else {
        // Register system name
        if (field === "system") {
          this._name += trimmed;
        }

        this.appendFieldLine(field, trimmed);
      }
    }

    if (start_level !== if_stack.length) {
      console.warn("Unexpected if/else stack ending:", if_stack);
    }
  }

  protected handlePreprocessors(
    line: string, 
    if_stack: ConditionalState[], 
    can_read: boolean, 
    line_no: number, 
    filename: string
  ) : boolean | null | undefined {
    const [instruction, content] = line.slice(1).trim().split(ItpFile.BLANK_REGEX, 2);

    if (instruction === "define") {
      const [name, value] = content.split(ItpFile.BLANK_REGEX);

      if (value === undefined) {
        this.defines[name] = true;
      }
      else if (!isNaN(Number(value))) {
        this.defines[name] = Number(value);
      }
      else {
        this.defines[name] = value;
      }
    }
    else if (instruction === "ifdef") {
      if (can_read) {
        if (content in this.defines) {
          if_stack.push(ConditionalState.Validated);
        }
        else {
          if_stack.push(ConditionalState.Unvalidated);
          can_read = false;
        }
      }
      else {
        if_stack.push(ConditionalState.NotReadable);
      }
      return can_read;
    }
    else if (instruction === "ifndef") {
      if (can_read) {
        if (content in this.defines) {
          if_stack.push(ConditionalState.Unvalidated);
          can_read = false;
        }
        else {
          if_stack.push(ConditionalState.Validated);
        }
      }
      else {
        if_stack.push(ConditionalState.NotReadable);
      }
      return can_read;
    }
    else if (instruction === "else") {
      if (if_stack.length === 0) {
        throw new Error(`Unexpected else statement on line ${line_no} in file ${filename}.`);
      }

      const last_el = if_stack.pop();

      if (last_el === ConditionalState.Unvalidated) {
        // This was an unvalidated if, now we can read
        can_read = true;
        if_stack.push(ConditionalState.EnteredElse);
      }
      else if (last_el === ConditionalState.Validated) {
        // This was a validated if, from now we can't read
        can_read = false;
        if_stack.push(ConditionalState.EnteredElse);
      }
      else if (last_el === ConditionalState.EnteredElse) {
        // This should not happen.
        throw new Error(`Unexpected else statement on line ${line_no} in file ${filename}.`);
      }
      else {
        // We can't read. Do nothing. Repush the not readable state to unpop it when endif.
        if_stack.push(ConditionalState.NotReadable);
      }
      return can_read;
    }
    else if (instruction === "endif") {
      if (if_stack.length === 0) {
        throw new Error(`Unexpected endif statement on line ${line_no} in file ${filename}.`);
      }

      const last_el = if_stack.pop();

      if (last_el !== ConditionalState.NotReadable) {
        // This was a read-if, now we can read normally
        can_read = true;
      }
      else {
        // We can't read.
      }
      return can_read;
    }

    // else: unsupported instructionr
    return undefined;
  }

  protected getLineReader(from: Partial<ReadEntry>) {
    let reader: AsyncLineReader | undefined;

    if (from.path) {
      reader = readline.createInterface({
        input: fs.createReadStream(from.path),
        crlfDelay: Infinity,
      })[Symbol.asyncIterator]();
    }
    else if (from.stream) {
      reader = readline.createInterface({
        input: from.stream,
        crlfDelay: Infinity,
      })[Symbol.asyncIterator]();
    }
    else if (from.content) {
      reader = this.stringLineReader(from.content);
    }
    else if (from.file) {
      reader = new LineFileReader(from.file).iterate();
    }
    else if (from.none) {
      reader = undefined;
    }
    else {
      throw new Error("You must specify an entry point.");
    }

    return reader;
  }

  protected async *stringLineReader(content: string) {
    for (const line of content.split('\n')) {
      yield line;
    }
  }


  /* Public methods before read */

  /**
   * **To do before calling `.read()`.**
   * 
   * Define a new variable that can be used in `ifdef` and `ifndef` statements.
   */
  define(name: string, value: any = true) {
    this.defines[name] = value;
  }

  /**
   * Starts the read of the file.
   * This method can be called only once !
   * 
   * @param data Way to read the file (path, `File`, stream...)
   * @param on_include Closure to call with the name of the file to be included. Must return a `Partial<ReadEntry>`. Default to `path => ({ path })`.
   */
  async read(data: Partial<ReadEntry>, on_include: Includer = this.on_include) {
    const reader = this.getLineReader(data);
    this.on_include = on_include;

    if (!reader)
      throw new Error("You must specifiy an entry point for TOP file.");

    const filename = data.path ? path.basename(data.path) : '<Topology file>';
    
    await this.readLinesFrom(reader, filename);
    this.indexate();
  }


  /* Public methods after read */

  /** Name of the system. */
  get name() {
    return this._name;
  }

  /**
   * Return all `MoleculeDefinition` associated to this `moleculetype`.
   */
  getMolecule(name: string) {
    return this.molecules.filter(e => e.type === name);
  }

  /**
   * Emit a string representation of this system as a ReadableStream.
   * 
   * All included ITPs will be emitted inside the stream.
   */
  asReadStream() {
    const stm = new stream.Readable;

    setTimeout(async () => {
      // Emit the headlines
      for (const line of this.headlines) {
        stm.push(line + '\n');
      }

      // Emit each molecule
      let seen_itps = new Set<ItpFile>();
      for (const mol of this.molecules) {
        if (!mol.itp || seen_itps.has(mol.itp))
          continue;
          
        seen_itps.add(mol.itp);

        // Emit the molecule if it has an ITP file attached
        await new Promise((resolve, reject) => {
          const molstm = mol.itp.asReadStream();
          
          molstm.on('data', chunk => {
            stm.push(chunk);
          });
  
          molstm.on('end', resolve);
          molstm.on('error', reject);
        });
      }

      // Emit the rest of the fields
      for (const field in this.data) {
        if (field === ItpFile.HEADLINE_KEY) {
          continue;
        }

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

    // Emit the headlines
    str += this.headlines.length ? (this.headlines.join('\n') + '\n') : "";

    // Emit each molecule
    let seen_itps = new Set<ItpFile>();
    for (const mol of this.molecules) {
      if (!mol.itp || seen_itps.has(mol.itp)) {
        continue;
      }
        
      seen_itps.add(mol.itp);

      str += mol.itp.toString();
    }

    // Emit the rest of the fields
    for (const field in this.data) {
      if (field === ItpFile.HEADLINE_KEY) {
        continue;
      }

      str += `\n[${field}]\n`;
      str += this.data[field].join('\n') + '\n';
    }

    return str;
  }
}
