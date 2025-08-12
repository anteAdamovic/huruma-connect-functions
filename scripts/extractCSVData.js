const { Client } = require('pg');
const fs = require('fs');
const csv = require('csv-parser');

const fileUrl = 'data.csv';

const results = [];

function extractData(rows) {
    const data = [];

    rows.forEach(row => {
        if (row.raw) {
            data.push(JSON.parse(row.raw).data);
        }
    });

    console.log(data.map(d => d.healthcare_provider));
}

fs.createReadStream(fileUrl)
  .pipe(csv())
  .on('data', (row) => {
    results.push(row);
  })
  .on('end', () => {
    console.log('CSV file successfully processed!');
    extractData(results);
  });
