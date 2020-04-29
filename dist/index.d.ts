/// <reference types="node" />
import stream from 'stream';
export declare type TopologyField = string[];
export declare class ItpFile {
    protected file?: string | NodeJS.ReadableStream | undefined;
    protected data: {
        [itp_field: string]: TopologyField;
    };
    protected _includes: string[];
    static HEADLINE_KEY: string;
    static BLANK_REGEX: RegExp;
    constructor(file?: string | NodeJS.ReadableStream | undefined);
    /**
     * Read ITPs that contains multiple molecules.
     */
    static readMany(file: string | NodeJS.ReadableStream): Promise<ItpFile[]>;
    static readFromString(data: string): ItpFile;
    static read(file: string | NodeJS.ReadableStream): Promise<ItpFile>;
    read(file?: string | NodeJS.ReadableStream): Promise<void>;
    protected readLine(line: string, current_field: string): string | undefined;
    getField(name: string): TopologyField;
    setField(name: string, data: string[]): void;
    get headlines(): TopologyField;
    get name_and_count(): (string | number)[];
    get name(): string | number;
    get molecule_count(): string | number;
    get atoms(): TopologyField;
    get bonds(): TopologyField;
    get virtual_sites(): TopologyField;
    get includes(): string[];
    get included_files(): string[];
    asReadStream(): stream.Readable;
    toString(): string;
    /**
     * Remove data from this ITP. You can't read it after this!
     */
    dispose(): void;
}
export declare type MoleculeDefinition = {
    itp: ItpFile;
    count: number;
};
export declare class TopFile extends ItpFile {
    protected top_file: string | NodeJS.ReadableStream;
    protected itp_files: (string | NodeJS.ReadableStream)[];
    allow_system_moleculetype_only: boolean;
    readonly molecules: [string, MoleculeDefinition][];
    constructor(top_file: string | NodeJS.ReadableStream, itp_files?: (string | NodeJS.ReadableStream)[], allow_system_moleculetype_only?: boolean);
    read(): Promise<void>;
    protected static initItpData(instance: TopFile): {
        instance: TopFile;
        molecules_count: {
            [name: string]: number;
        };
    };
    protected static registerItp(instance: TopFile, itp: ItpFile, molecules_count: {
        [name: string]: number;
    }): void;
    static readFromString(data: string, itp_data?: string[]): TopFile;
    getMolecule(name: string): MoleculeDefinition[];
    get molecule_list(): MoleculeDefinition[];
    get system(): TopologyField;
    /**
     * All includes of TOP file, and all of included ITP files. Remove possible duplicates.
     */
    get nested_includes(): string[];
    /**
     * Remove data from all itps included and top file.
     */
    dispose(): void;
}
export default ItpFile;
