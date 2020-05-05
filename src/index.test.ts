import { TopFile, ItpFile, AdvancedTopFile } from '.';
import path from 'path';
import assert from 'assert';

enum LogLevel {
  Silly,
  Debug,
  Info,
  Warn,
  Error,
};

const LEVEL = LogLevel.Debug;
const FILES = path.resolve(__dirname, '../itp_test');

const info = (...values: any[]) => LEVEL >= LogLevel.Info ? console.log("[INFO]", ...values) : undefined;
const error = (...values: any[]) => LEVEL >= LogLevel.Error ? console.error("[ERROR]", ...values) : undefined;
const warn = (...values: any[]) => LEVEL >= LogLevel.Warn ? console.warn("[WARN]", ...values) : undefined;
const debug = (...values: any[]) => LEVEL >= LogLevel.Debug ? console.log("[DEBUG]", ...values) : undefined;
const silly = (...values: any[]) => LEVEL >= LogLevel.Silly ? console.log("[SILLY]", ...values) : undefined;

// Used to inspect with Node CLI
// cd dist; node
// let { items } = require('index.test')
export let items: any = {};

(async () => {
  info("Starting test for single DPPC ITP.");

  const dppc_arr = await ItpFile.readMany(FILES + '/single_DPPC.itp');
  assert.strictEqual(dppc_arr.length, 1, "Hold a single ITP.");
  
  const dppc = dppc_arr[0];
  assert.deepStrictEqual(dppc.name_and_nrexcl, ["DPPC", 1]);

  items.dppc = dppc;

  info("Starting test of multi phospholipids")
  const phospholipids = await ItpFile.readMany(FILES + '/multi_phospholipids.itp');
  assert.strictEqual(phospholipids.length, 5, "Hold a single ITP.");
  
  items.phospholipids = phospholipids;

  info("Starting test of classic kwalp system")
  const kwalp = await TopFile.read(
    FILES + '/kwalp_system.top', 
    [
        FILES + '/kwalp_molecule_0.itp', 
        FILES + '/single_DPPC.itp', 
        FILES + '/single_DIPC.itp' 
    ]
  );

  assert.strictEqual(kwalp.registred_itps.size, 3);

  items.kwalp = kwalp;

  info("Starting test of semi-included kwalp system")
  const kwalp_included = await TopFile.read(
    FILES + '/kwalp_system_filled.top', 
    [
        FILES + '/kwalp_molecule_0.itp', 
    ]
  );

  assert.strictEqual(kwalp_included.registred_itps.size, 3);

  items.kwalp_included = kwalp_included;

  const kwalp_full = new AdvancedTopFile(true);
  await kwalp_full.read({ path: FILES + '/kwalp_system.full.top' }, path => ({ path: FILES + '/' + path }));

  items.kwalp_full = kwalp_full;

  const as_str = kwalp_full.toString();
  for (let i = 1; i < 5; i++) {
    assert.strictEqual(as_str.includes("SHOULD" + i), true);
  }

  for (let i = 1; i < 10; i++) {
    assert.strictEqual(as_str.includes("NOT" + i), false);
  }

  items.adv = AdvancedTopFile;
})();

