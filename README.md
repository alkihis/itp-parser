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

## Usage

Async file read accepts `string` (as file path), `NodeJS.ReadableStream` and `File` objects (of browser).

Sync file read `string` (as file content).

### Read an ITP with none/single moleculetype field

The following sections will talk about the `ItpFile` object.

---

```ts
import { ItpFile } from 'itp-parser';
import fs from 'fs';

// Read asynchrounously
(async () => {
  // Single line instanciation
  const file = await ItpFile.read('/path/to/file');

  console.log("This ITP hold moleculetype", file.name);
  // {file} is ready !
})();

// Read synchronously
const file = ItpFile.readFromString(fs.readFileSync('/path/to/file.itp', 'utf-8'));
// {file} is ready
```

### Read an ITP with none/single/multiple moleculetype field

Multiple moleculetype parsing does not have synchronous counterpart.

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
```

### Access a field

Every field is an array of strings (array of lines).

```ts
file.getField('{field_name}'); // => string[] (every line contained in the field. Empty lines are skipped.)

// For example: Access to all atoms
file.getField('atoms');
```

#### Shortcuts

Some fields have direct accessor:
```ts
file.name_and_count; // => [string, number]. parsed version of file.getField('moleculetype')
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
const top = new TopFile('/path/to/top', ['/path/to/itp1', '/path/to/itp2']);
await top.read();

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
for (const [name, molecule] of top.molecules) {
  console.log("Molecule", molecule.itp.name, ":", molecule.count, "times in the system");
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

top.molecules.filter(e => e.name === "DPPC")[0].itp; // => ItpFile
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

`top.molecules` is an array of tuples `[string, MoleculeDefinition]`.

The first `string` is the molecule type, 
and the `MoleculeDefinition` is an object containing two fields:
- `itp`: Contains the related `ItpFile` for this molecule type 
- `count`: Associated count of the molecule type, number on the right in example

In order to access `ItpFile` instance, you must provide the ITP for the given `moleculetype` in the constructor.

```ts
const molecules = top.molecules.filter(e => e[0] === "DPPC");

if (molecules) {
  console.log("Molecule DPPC is present", molecules.reduce((acc, cur) => acc + cur[1].count, 0), "times in the system");
}
```

The `TopFile` instance inherits from `ItpFile`, so all methods presented before are accessible with.

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
