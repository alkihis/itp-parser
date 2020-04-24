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
        this.includes = [];
    }
    read() {
        var e_1, _a;
        return __awaiter(this, void 0, void 0, function* () {
            const rl = readline_1.default.createInterface({
                input: typeof this.file === 'string' ? fs_1.default.createReadStream(this.file) : this.file,
                crlfDelay: Infinity,
            });
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
                        continue;
                    }
                    if (trimmed.startsWith('#include')) {
                        this.includes.push(trimmed);
                    }
                    if (field in this.data)
                        this.data[field].push(trimmed);
                    else
                        this.data[field] = [trimmed];
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (rl_1_1 && !rl_1_1.done && (_a = rl_1.return)) yield _a.call(rl_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        });
    }
    getField(name) {
        if (name in this.data)
            return this.data[name];
        return [];
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
    /**
     * Remove data from this ITP. You can't read it after this!
     */
    dispose() {
        this.data = {};
        this.includes = [];
    }
}
exports.ItpFile = ItpFile;
ItpFile.HEADLINE_KEY = '_____begin_____';
ItpFile.BLANK_REGEX = /\s+/;
class TopFile extends ItpFile {
    constructor(top_file, itp_files) {
        super(top_file);
        this.top_file = top_file;
        this.itp_files = itp_files;
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
            }
            for (const file of this.itp_files) {
                const itp = new ItpFile(file);
                yield itp.read();
                const [name, count] = itp.name_and_count;
                if (!(name in molecules_count)) {
                    // this molecule is not in the system
                    continue;
                }
                if (!(name in this.molecules))
                    this.molecules[name] = [];
                for (let i = 0; i < molecules_count[name]; i++) {
                    this.molecules[name].push(itp);
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
     * Remove data from all itps included and top file.
     */
    dispose() {
        super.dispose();
        for (const itps of Object.values(this.molecules)) {
            for (const itp of itps) {
                itp.dispose();
            }
        }
    }
}
exports.TopFile = TopFile;
exports.default = ItpFile;
