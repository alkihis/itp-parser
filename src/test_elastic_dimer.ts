import { TopFile, ItpFile} from '.'
import path from 'path';
import fs from 'fs';

const FILES = path.resolve(__dirname, '../itp_test/dimer_elastic');

(async() => {
    const top = await TopFile.read(FILES + "/1a2w.top", [FILES + "/1a2w_A.itp", FILES + "/1a2w_B.itp"])

    for (const mol of top.molecules){
        const file = mol.itp; 
        const rubberBands = file.getSubfield("bonds", "Rubber band")

        const itp = new ItpFile();
        
        itp.appendField("bonds", rubberBands)
        fs.writeFileSync(FILES + "/" + mol.type + "_without_rubber.itp", itp.toString())
    
        file.removeSubfield("bonds", "Rubber band"); 
        file.appendInclude(mol.type + "_rubber.itp", "bonds"); 
        
        fs.writeFileSync(FILES + "/" + mol.type + "_rubber.itp", file.toString())
    }
   


})();