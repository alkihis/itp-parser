/// <reference types="node" />
import stream from 'stream';
export declare type TopologyField = string[];
export declare class ItpFile {
    protected file: string | NodeJS.ReadableStream;
    protected data: {
        [itp_field: string]: TopologyField;
    };
    protected includes: string[];
    protected static HEADLINE_KEY: string;
    static BLANK_REGEX: RegExp;
    constructor(file: string | NodeJS.ReadableStream);
    read(): Promise<void>;
    getField(name: string): TopologyField;
    get headlines(): TopologyField;
    get name_and_count(): (string | number)[];
    get name(): string | number;
    get molecule_count(): string | number;
    get atoms(): TopologyField;
    get bonds(): TopologyField;
    get virtual_sites(): TopologyField;
    asReadStream(): stream.Readable;
    /**
     * Remove data from this ITP. You can't read it after this!
     */
    dispose(): void;
}
export declare class TopFile extends ItpFile {
    protected top_file: string | NodeJS.ReadableStream;
    protected itp_files: (string | NodeJS.ReadableStream)[];
    protected molecules: {
        [name: string]: ItpFile[];
    };
    constructor(top_file: string | NodeJS.ReadableStream, itp_files: (string | NodeJS.ReadableStream)[]);
    read(): Promise<void>;
    getMolecule(name: string): ItpFile[];
    get molecule_list(): [string, ItpFile[]][];
    get system(): TopologyField;
    /**
     * Remove data from all itps included and top file.
     */
    dispose(): void;
}
export default ItpFile;
