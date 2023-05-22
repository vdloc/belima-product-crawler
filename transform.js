import fs from 'fs';
import { parse, transform, stringify } from 'csv';
import xlsx from 'xlsx';

(async () => {
  const spreadsheet = await xlsx.readFile('./input.xlsx');
  await xlsx.writeFile(spreadsheet, './input.csv', { bookType: 'csv' });

  fs.createReadStream('./input.csv')
    .pipe(parse({ delimiter: ',' }))
    .pipe(
      transform(function (record) {
        return record.map(function (value) {
          if (value.includes('\n')) {
            return `<div>${value.replaceAll('\n', ' <br/> ')}</div>`;
          }
          return value;
        });
      })
    )
    .pipe(stringify({ quoted: true }))
    .pipe(fs.createWriteStream('./output.csv'));
})();
