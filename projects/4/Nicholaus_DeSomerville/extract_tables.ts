import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'node-html-parser';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';

const dataDir = './data';
const htmlFiles = readdirSync(dataDir).filter(f => f.endsWith('.html'));

function extractTablesFromHTML(filename: string, html: string): void {
  const root = parse(html);
  const tables = root.querySelectorAll('table');
  const baseName = filename.replace('.html', '');

  tables.forEach((table, index) => {
    const rows = table.querySelectorAll('tr');
    const csv = rows.map(row =>
      row.querySelectorAll('th,td')
        .map(cell => `"${cell.text.trim().replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const outputFilename = `${baseName}_table_${index + 1}.csv`;
    writeFileSync(outputFilename, csv);
  });
}

function runSequential(): void {
  const startTime = performance.now();

  for (const file of htmlFiles) {
    const html = readFileSync(join(dataDir, file), 'utf-8');
    extractTablesFromHTML(file, html);
  }

  const endTime = performance.now();
  console.log(`Sequential Execution Time: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
}

function runMultithreaded(): void {
  const startTime = performance.now();
  let completed = 0;

  htmlFiles.forEach(file => {
    const worker = new Worker(__filename, {
      workerData: { fileName: file, dataDir }
    });

    worker.on('exit', () => {
      completed++;
      if (completed === htmlFiles.length) {
        const endTime = performance.now();
        console.log(`Multithreaded Execution Time: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
      }
    });
  });
}

if (isMainThread) {
  const mode = process.argv[2] || 'sequential';
  if (mode === 'parallel') {
    runMultithreaded();
  } else {
    runSequential();
  }
} else {
  const { fileName, dataDir } = workerData;
  const html = readFileSync(join(dataDir, fileName), 'utf-8');
  extractTablesFromHTML(fileName, html);
  process.exit();
}
