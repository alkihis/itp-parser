"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readline_1 = __importDefault(require("readline"));
const fs_1 = __importDefault(require("fs"));
const stream_1 = __importDefault(require("stream"));
class ItpFile {
    constructor(file) {
        this.file = file;
        this.data = {};
        this._includes = [];
    }
    /**
     * Read ITPs that contains multiple molecules.
     */
    static readMany(file) {
        var e_1, _a;
        return __awaiter(this, void 0, void 0, function* () {
            const rl = readline_1.default.createInterface({
                input: typeof file === 'string' ? fs_1.default.createReadStream(file) : file,
                crlfDelay: Infinity,
            });
            let f = new ItpFile;
            let initial = true;
            const files = [f];
            let field = ItpFile.HEADLINE_KEY;
            try {
                for (var rl_1 = __asyncValues(rl), rl_1_1; rl_1_1 = yield rl_1.next(), !rl_1_1.done;) {
                    const line = rl_1_1.value;
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
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (rl_1_1 && !rl_1_1.done && (_a = rl_1.return)) yield _a.call(rl_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return files;
        });
    }
    static readFromString(data) {
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
    static read(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const itp = new ItpFile;
            yield itp.read(file);
            return itp;
        });
    }
    read(file) {
        var e_2, _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (!file) {
                file = this.file;
            }
            if (!file) {
                throw new Error("You must instanciate ITP file with a stream/path, or specify a stream/path when calling read()");
            }
            const rl = readline_1.default.createInterface({
                input: typeof file === 'string' ? fs_1.default.createReadStream(file) : file,
                crlfDelay: Infinity,
            });
            let field = ItpFile.HEADLINE_KEY;
            try {
                for (var rl_2 = __asyncValues(rl), rl_2_1; rl_2_1 = yield rl_2.next(), !rl_2_1.done;) {
                    const line = rl_2_1.value;
                    const new_f = this.readLine(line, field);
                    if (new_f) {
                        field = new_f;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (rl_2_1 && !rl_2_1.done && (_a = rl_2.return)) yield _a.call(rl_2);
                }
                finally { if (e_2) throw e_2.error; }
            }
        });
    }
    readLine(line, current_field) {
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
    getField(name) {
        if (name in this.data)
            return this.data[name];
        return [];
    }
    setField(name, data) {
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
        const stm = new stream_1.default.Readable;
        setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            for (const field in this.data) {
                if (field !== ItpFile.HEADLINE_KEY)
                    stm.push(`[${field}]\n`);
                for (const line of this.data[field]) {
                    stm.push(line + '\n');
                }
                yield new Promise(resolve => setTimeout(resolve, 5));
            }
            stm.push(null);
        }), 5);
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
exports.ItpFile = ItpFile;
ItpFile.HEADLINE_KEY = '_____begin_____';
ItpFile.BLANK_REGEX = /\s+/;
class TopFile extends ItpFile {
    constructor(top_file, itp_files = [], allow_system_moleculetype_only = true) {
        super(top_file);
        this.top_file = top_file;
        this.itp_files = itp_files;
        this.allow_system_moleculetype_only = allow_system_moleculetype_only;
        this.molecules = {};
    }
    read() {
        const _super = Object.create(null, {
            read: { get: () => super.read }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.read.call(this);
            const molecules = this.getField('molecules');
            const molecules_count = {};
            for (const line of molecules) {
                const [name, count] = line.split(TopFile.BLANK_REGEX);
                molecules_count[name] = Number(count);
                // register in the case that moleculetype does not exists
                if (!this.allow_system_moleculetype_only) {
                    this.molecules[name] = {
                        // @ts-ignore
                        itp: null,
                        count: Number(count),
                    };
                }
            }
            for (const file of this.itp_files) {
                // Multiple molecules per ITP allowed
                const itps = yield ItpFile.readMany(file);
                for (const itp of itps) {
                    const name = itp.name;
                    if (!(name in molecules_count)) {
                        // this molecule is not in the system
                        continue;
                    }
                    this.molecules[name] = {
                        itp,
                        count: molecules_count[name],
                    };
                }
            }
        });
    }
    getMolecule(name) {
        var _a;
        return (_a = this.molecules[name]) !== null && _a !== void 0 ? _a : [];
    }
    get molecule_list() {
        return Object.entries(this.molecules);
    }
    get system() {
        return this.getField('system');
    }
    /**
     * All includes of TOP file, and all of included ITP files. Remove possible duplicates.
     */
    get nested_includes() {
        const includes = new Set();
        for (const include of this.includes) {
            includes.add(include);
        }
        for (const molecule in this.molecules) {
            for (const include of this.molecules[molecule].itp.includes) {
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
        for (const molecule of Object.values(this.molecules)) {
            molecule.itp.dispose();
        }
    }
}
exports.TopFile = TopFile;
exports.default = ItpFile;
