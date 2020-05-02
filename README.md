# itp-parser

> A basic ITP/TOP file parser

## Getting started

Install the package using npm.
```bash
npm i itp-parser
```

This package exports two objects: `ItpFile` and `TopFile`, whose have obvious usages.
Default export is `ItpFile`.

```ts
// ECMA Modules
import ItpFile, { TopFile } from 'itp-parser';
// or
import { ItpFile, TopFile } from 'itp-parser';

// CommonJS modules
const { ItpFile, TopFile } = require('itp-parser');
```

## Use target of `ItpFile` and `TopFile` instances

### `ItpFile` instance
- Hold a single molecule definition
- None or one `moleculetype` field per instance

### `TopFile` instance
- From a `molecules` field, associate every described molecule to a `ItpFile` instance
- System name

## Usage

### A word about the parser

This parser handle only basic parsing: 
It does **not** resolve includes, and it does **not** consider *`#define`*, *`#ifdef`* or other preprocessor statements.

Lines that contains those preprocessors are stored as plain lines in field definitions.

To have a support of includes and basic support of preprocessors, see `AdvancedTopFile` object.

### About accepted types for ITP instanciation

Async instanciation accepts `string` (as file path), `NodeJS.ReadableStream` and `File`/`Blob` objects (from browser).

Sync instanciation accepts `string` (as file content).

### Read an ITP with none/single moleculetype field

The following sections will talk about the `ItpFile` object.

---

If you know that your ITP file does not contain a molecule (`moleculetype`) definition,
or contains only one definition, 
use `ItpFile.read()` or `ItpFile.readFromString()` as constructor.

```ts
import { ItpFile } from 'itp-parser';
import fs from 'fs';

// Read asynchrounously
(async () => {
  // Single line instanciation
  // With file path
  const file = await ItpFile.read('/path/to/file');
  // With a readable stream
  const file = await ItpFile.read(fs.createReadStream('/path/to/file'));
  // With a File/Blob (inside a browser)
  const file = await ItpFile.read(document.querySelector('input[type="file"]').files[0]);

  console.log("This ITP hold moleculetype", file.name);
  // {file} is ready !
})();

// Read synchronously
const file = ItpFile.readFromString(fs.readFileSync('/path/to/file.itp', 'utf-8'));
// {file} is ready
```

### Read an ITP with none/single/multiple moleculetype field

If your ITP contain multiple molecule definitions, or if you don't know how many `moleculetype` are presents
in the targeted ITP, use `ItpFile.readMany()` or `ItpFile.readManyFromString()` as constructor.

It both returns a array of `ItpFile`, once per `moleculetype` definition.

If the ITP does not contain any `moleculetype`, an array of one `ItpFile` is returned.

```ts
import { ItpFile } from 'itp-parser';

// Asynchrounously
(async () => {
  const itps = await ItpFile.readMany('/path/to/file');

  for (const itp of itps) {
    console.log("ITP: moleculetype", itp.name);
  }

  // All itps are ready !
})();

// Read synchronously
const itps = ItpFile.readManyFromString(fs.readFileSync('/path/to/file.itp', 'utf-8'));
```

### Access a field

Every field is an array of strings (array of lines).

```ts
file.getField('{field_name}'); // => string[] (every line contained in the field. Empty lines are skipped.)

// For example: Access to all atoms
file.getField('atoms');

// Get a field without the lines that are only comments
file.getField('atoms', true);
```

#### Shortcuts

Some fields have direct accessor:
```ts
file.name; // Name/Type. Read from moleculetype
file.name_and_nrexcl; // => [string, number]. parsed version of file.getField('moleculetype')
file.atoms; // string[]. Equivalent to file.getField('atoms')
file.bonds; // string[]. Equivalent to file.getField('bonds')
file.virtual_sites; // string[]. Equivalent to file.getField('virtual_sitesn')
```

#### Access to data before every field

Lines read before encountering a single field declaration are stored in `.headlines`.

```ts
file.headlines; // => string[]
```

### Write ITPs

You can change data of a field with `.setField(name, lines)` and create a read stream of this ITP with `.asReadStream()`.

```ts
import fs from 'fs';

// Change the atom field with modified data
file.setField('atoms', file.atoms.filter(line => line.split(/\s+/).length > 3));

// Write the new ITP
const writestm = fs.createWriteStream('/path/to/output.itp');

new Promise((resolve, reject) => {
  const reads = file.asReadStream();

  reads.on('close', resolve);
  reads.on('error', reject);
  writestm.on('error', reject);
  
  reads.pipe(writestm);
}).then(() => {
  console.log("Write is over !");
}).catch(e => {
  console.log("An error occured.", e);
});
```

A `.toString()` method is also available to return the formatted ITP as a plain string.
```ts
const file_as_string = file.toString(); // or String(file)

fs.writeFileSync('/path/to/output.itp', file_as_string);
```

### Read a full system with a TOP file and ITPs

The following sections will talk about the `TopFile` object.

---

With the `TopFile` object, you can read a TOP file and associated ITPs.

In order to link `moleculetype` described in `molecules` field of TOP with ITP data, you either:

- Have to manually resolve the included files before reading the TOP file, and specify ITP files in constructor
- Sideload manually the ITPs

```ts
// Asynchronously
const top = await TopFile.read('/path/to/top', ['/path/to/itp1', '/path/to/itp2']);

// Synchronously
const top = TopFile.readFromString(
  fs.readFileSync('/path/to/top', 'utf-8'), 
  [
    fs.readFileSync('/path/to/itp1', 'utf-8'),
    fs.readFileSync('/path/to/itp2', 'utf-8'),
  ]
);

// {top} is ready !
```

### List molecules of a system
```ts
for (const molecule of top.molecules) {
  console.log("Molecule", molecule.type, ":", molecule.count, "times in the system");
}
```

### Sideload ITPs in a system

When you know which `moleculetype` is present in the system, you can load inside the `TopFile` instance the ITPs you want.

```ts
// Asynchronously
await top.sideloadItp('/path/to/itp');

// Synchronously
top.sideloadItpFromString(fs.readFileSync('/path/to/itp', 'utf-8'));
```

For example, if your system contain `DPPC`:

```ts
// If your file contains multiple moleculetype, they're all parsed in async mode
await top.sideloadItp('lipids.itp');

top.molecules.filter(e => e.type === "DPPC")[0].itp; // => ItpFile
```

### Get a molecule by name in a system

A molecule can be described multiple times in a system, for example:
```itp
[ molecules ]
molecule_0  2
molecule_1  3
molecule_0  1
```
is a valid format for GROMACS. 
For this reason, a molecule type can be present multiple time in the `top.molecules` array.

`top.molecules` is an array of `MoleculeDefinition`.

```ts
interface MoleculeDefinition {
  itp: ItpFile, 
  count: number, 
  type: string 
}
```

The first `string` is the molecule type, 
and the `MoleculeDefinition` is an object containing two fields:
- `itp`: Contains the related `ItpFile` for this molecule type 
- `count`: Associated count of the molecule type, number on the right in example

In order to access `ItpFile` instance, you must provide the ITP for the given `moleculetype` in the constructor.

```ts
const molecules = top.molecules.filter(e => e.type === "DPPC");

if (molecules) {
  console.log("Molecule DPPC is present", molecules.reduce((acc, cur) => acc + cur.count, 0), "times in the system");
}
```

The `TopFile` instance inherits from `ItpFile`, so all methods presented before are accessible with.

### Advanced TOP parser

`AdvancedTopFile` have a similar API of `TopFile`, except some points.

Therefore, unlike the other classes, you must instanciate it with the constructor then using `.read(what: ReadEntry, onInclude: Includer)`.

This class accepts files with a `ReadEntry` partial object.
```ts
interface ReadEntry {
  path: string;
  stream: NodeJS.ReadableStream; 
  content: string;
  file: Blob;
  /** Only valid on return of a `on_include` closure. */
  none: true;
}
```
To specify which file you want to load, fill **only one** of the properties of the object.

In order to resolve includes, you must specify a callback (async or not) that returns a `ReadEntry` as the second parameter of `.read` method.

```ts
type Includer = (filename: string) => Partial<ReadEntry> | Promise<Partial<ReadEntry>>;
```

---

Let's see how it works with an example:

```ts
import { AdvancedTopFile } from 'itp-parser';
import fs, { promises as FsPromise } from 'fs';

const top = new AdvancedTopFile(/* enable_preprocessors = */ true);

await top.read(
  /* the file to read */ { path: '/path/to/file.top' },
  /* when a file is included */ 
  async (name: string) => {
    const exists = await FsPromise.access(name, fs.F_OK)
      .then(() => true)
      .catch(() => false);

    if (exists) {
      // If file exists, include it as path
      return { path: name };
    }
    // Otherwise, fill the none field (do not include it)
    return { none: true };
  }
);

// Your whole system described by file.top is ready, 
// even included files are resolved !
```

The following methods/properties are available:
- `.define(name: string)`: To do before `.read()`; Define a macro, like `#define NAME` in a ITP file
- All the methods of `ItpFile`, this object inherits from it
- The same as `TopFile`:
  - `.registred_itps`: A `Set` of all molecules as `ItpFile`s
  - `.molecules`: A `MoleculeDefinition` array
  - `.name`: Name of the system
  - `.getMolecule(name: string)`: A `MoleculeDefinition` array containing all occurence of molecule `{name}`
- `.includes`: All the `#include` lines (they're not inside the fields arrays, so you can find them here)
- `.toString()` and `.asReadStream()`: a `string`/`stream.Readable` representation of the system; all included files are emitted in the stream, so the system could be written a a single file



## Self-installation

This module is written in TypeScript.
In order to use it, you must have the TypeScript compiler installed.

```bash
git clone https://github.com/alkihis/itp-parser.git
cd itp-parser
npm i
tsc
# Compiled JS entrypoint is in dist/index.js
```
