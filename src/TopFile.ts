import { ItpFile, AsyncFile } from "./ItpFile";

/**
 * A line of the `molecules` field in a TOP file.
 * Contain specified count in this line, and a reference to molecule ITP if any.
 */
export type MoleculeDefinition = { itp: ItpFile, count: number, type: string };

/**
 * Describe a system through a TOP file.
 * 
 * The TOP file **must** not contain any molecule definition, take care of splitting them inside ITPs.
 */
export class TopFile extends ItpFile {
  /** List (in the order of the `molecules` field) of the molecules in this system. */
  public readonly molecules: MoleculeDefinition[] = [];

  /** Contain all read ITPs splitted by `moleculetype`, even those present in given TOP file. */
  public readonly registred_itps: Set<ItpFile> = new Set;

  protected constructor() {
    super();
  }

  /* PROTECTED INIT METHODS */

  protected initItpData() {
    const molecules = this.getField('molecules');

    for (const line of molecules) {
      const [name, count] = line.split(TopFile.BLANK_REGEX);

      // register in the case that moleculetype does not exists
      this.molecules.push(
        // @ts-ignore
        { itp: null, count: Number(count), type: name }
      );
    }

    // Test if ITPs are stashed (if so, register them)
    for (const itp of [...this.registred_itps]) {
      this.registerItp(itp);
    }

    return this;
  }

  protected registerItp(itp: ItpFile) {
    const name = itp.name;
    this.registred_itps.add(itp);
    
    for (const mol of this.molecules.filter(e => e.type === name)) {
      mol.itp = itp; 
    }
  }

  protected initFromItpArray(itps: ItpFile[]) {
    const first = itps[0];
    const last = itps[itps.length - 1];

    // Copy required data
    this.setField(ItpFile.HEADLINE_KEY, first.headlines);
    this.setField('system', last.getField('system'));
    this.setField('molecules', last.getField('molecules'));

    last.removeField('system');
    last.removeField('molecules');
    first.setField(ItpFile.HEADLINE_KEY, []);

    if (first !== last) {
      // there is multiple items (so every item have a moleculetype!)
      // 1- remove system and molecules from last (done before)
      // 2- Remove headlines of first (done before)
      // 3- Register every ITP in the stash stack
      for (const itp of itps) {
        this.registred_itps.add(itp);
      }
    }
    else {
      // One ITP. system, molecules and headlines are cleared.

      // If the ITP holds molecule data, register it in the stash stack.
      if (first.hasField('moleculetype')) {
        this.registred_itps.add(first);
      }
    }
  }


  /* STATIC CONSTRUCTORS */

  /**
   * Asynchronously read TOP/ITP files by path/readable stream/`File`/`Blob`.
   */
  static async read(top_file: AsyncFile, itp_files: AsyncFile[] = []) {
    const instance = new TopFile;

    // This reads the top file
    instance.initFromItpArray(await ItpFile.readMany(top_file));

    instance.initItpData();

    for (const file of itp_files) {
      // Multiple molecules per ITP allowed
      const itps = await ItpFile.readMany(file);
      
      for (const itp of itps) {
        instance.registerItp(itp);
      }
    }

    return instance;
  }

  /**
   * Synchronously read TOP/ITP data with a plain string.
   */
  static readFromString(data: string, itp_data: string[] = []) {
    const f = new TopFile;

    // this reads the ITP data
    f.initFromItpArray(ItpFile.readManyFromString(data));

    // This parse molecules
    f.initItpData();

    // This parsed asked ITPs
    for (const file of itp_data) {
      // Multiple molecules per ITP allowed
      const itps = ItpFile.readManyFromString(file);

      for (const itp of itps) {
        f.registerItp(itp);
      }
    }

    return f;
  }


  /* ITP SIDELOADING */

  async sideloadItp(itp: AsyncFile) {
    const itps_instance = await ItpFile.readMany(itp);

    for (const itp_instance of itps_instance)
      this.registerItp(itp_instance);
  }

  sideloadItpFromString(itp: string) {
    const itps = ItpFile.readManyFromString(itp);

    for (const itp of itps) {
      this.registerItp(itp);
    }
  }


  /* FIELD GETTERS */
 
  /**
   * Return all `MoleculeDefinition` associated to this `moleculetype`.
   */
  getMolecule(name: string) {
    return this.molecules.filter(e => e.type === name);
  }

  /** Usually, contain the name of the system. Unparsed version of `.name` */
  get system() {
    return this.getField('system');
  }

  /** Name of the system. */
  get name() {
    return this.system.join('').trim();
  }

  /**
   * This field is never valid for a TOP file.
   */
  get name_and_count() : never {
    throw new Error("System does not contains moleculetype field. Please see ITP files.");
  }

  /**
   * All includes of TOP file, and all of included ITP files. Remove possible duplicates.
   */
  get nested_includes() {
    const includes = new Set<string>();

    for (const include of this.includes) {
      includes.add(include);
    }

    for (const molecule of this.molecules) {
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
    this.registred_itps.clear();
    
    for (const molecule of this.molecules) {
      molecule.itp.dispose();
    }
  }
}

export default TopFile;
