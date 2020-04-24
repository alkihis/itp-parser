# itp-parser

> A basic ITP/TOP file parser

## Read single ITP files
### Read an ITP with none/single moleculetype field

```ts
import { ItpFile } from 'itp-parser';

(async () => {
  // Single line instanciation
  const file = await ItpFile.read('/path/to/file');
  // or, with classic constructor
  const file = new ItpFile('/path/to/file');
  await file.read(); // this is needed only with constructor

  console.log("This ITP hold moleculetype", file.name);
  // {file} is ready !
})();
```

### Read an ITP with none/single/multiple moleculetype field

```ts
import { ItpFile } from 'itp-parser';

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

## Read a full system with a TOP file and ITPs

With the `TopFile` object, you can read a TOP file and associated ITPs.

**You have to manually resolve the included files before reading the TOP file, and specify ITP files in constructor**

```ts
const top = new TopFile('/path/to/top', ['/path/to/itp1', '/path/to/itp2']);
await top.read();
```

### List molecules inside the system
```ts
for (const [name, molecule] of top.molecule_list) {
  console.log("Molecule", molecule.itp.name, ":", molecule.count, "times in the system");
}
```

### Get a molecule by name in the system
```ts
const molecule = top.molecules["DPPC"];

if (molecule) {
  console.log("Molecule DPPC is present", molecule.count, "times in the system");
}
```

The `TopFile` instance inherits from `ItpFile`, so all methods presented before are accessible with.
