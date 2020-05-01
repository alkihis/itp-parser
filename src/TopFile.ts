import readline from 'readline';
import fs from 'fs';
import LineFileReader from 'line-file-reader';
import { ItpFile, AsyncFile } from "./ItpFile";

export type MoleculeDefinition = { itp: ItpFile, count: number };

export class TopFile extends ItpFile {
  public readonly molecules: [string, MoleculeDefinition][] = [];

  async sideloadItp(itp: AsyncFile) {
    const itps_instance = await ItpFile.readMany(itp);

    for (const itp_instance of itps_instance)
      TopFile.registerItp(this, itp_instance);
  }

  sideloadItpFromString(itp: string) {
    const itp_instance = ItpFile.readFromString(itp);
    TopFile.registerItp(this, itp_instance);
  }

  protected static initItpData(instance: TopFile) {
    const molecules = instance.getField('molecules');

    for (const line of molecules) {
      const [name, count] = line.split(TopFile.BLANK_REGEX);

      // register in the case that moleculetype does not exists
      instance.molecules.push([
        name, 
        // @ts-ignore
        { itp: null, count: Number(count) }
      ]);
    }

    return instance;
  }

  protected static registerItp(instance: TopFile, itp: ItpFile) {
    const name = itp.name;
    
    for (const mol of instance.molecules.filter(e => e[0] === name)) {
      mol[1].itp = itp; 
    }
  }


  /* STATIC CONSTRUCTORS */

  static async read(top_file: AsyncFile, itp_files: AsyncFile[] = []) {
    const instance = new TopFile;
    const file = top_file;

    // Read the TOP file as ITP file
    const rl = LineFileReader.isFile(file) ? 
      new LineFileReader(file) : 
      readline.createInterface({
        input: typeof file === 'string' ? fs.createReadStream(file) : file,
        crlfDelay: Infinity,
      });

    let field = ItpFile.HEADLINE_KEY;

    for await (const line of rl) {
      const new_f = instance.readLine(line, field);
      if (new_f) {
        field = new_f;
      }
    }
    // End read ITP

    this.initItpData(instance);

    for (const file of itp_files) {
      // Multiple molecules per ITP allowed
      const itps = await ItpFile.readMany(file);
      
      for (const itp of itps) {
        this.registerItp(instance, itp);
      }
    }

    return instance;
  }

  static readFromString(data: string, itp_data: string[] = []) {
    const f = new TopFile;
    let field = ItpFile.HEADLINE_KEY;

    for (const line of data.split('\n')) {
      const new_f = f.readLine(line, field);
      if (new_f) {
        field = new_f;
      }
    }

    this.initItpData(f);

    for (const file of itp_data) {
      // Multiple molecules per ITP allowed
      const itp = ItpFile.readFromString(file);
      this.registerItp(f, itp);
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

export default TopFile;
