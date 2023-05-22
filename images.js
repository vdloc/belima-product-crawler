import { writeFile, readFile } from 'fs/promises';
import https from 'https';
import path from 'path';
import fs from 'fs';
import CacheableLookup from 'cacheable-lookup';
import fetch from 'node-fetch-retry';
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);
const option = {
  method: 'GET',
  retry: 20,
  callback: (retry) => {
    console.log(`Trying: ${retry}`);
  },
};

function getFileName(urlStr) {
  const url = new URL(urlStr);
  return path.basename(url.pathname);
}

async () => {
  const file = await readFile('output.csv', 'utf8');
  const urls = [
    ...new Set(
      file
        .match(/,https.+?jpg,/g)
        .map((url) => url.replaceAll(',', '').replace('/xs/', '/lg/'))
    ),
  ];

  for await (let url of urls) {
    const fileName = getFileName(url);
    const resp = await fetch(url, option);
    console.log(url);
    await streamPipeline(
      resp.body,
      fs.createWriteStream(`./images/${fileName}`)
    );
  }

  writeFile('image-urls.json', JSON.stringify(urls));
};

export default async function downloadImage(url) {
  const fileName = getFileName(url);
  const resp = await fetch(url, option);
  console.log(url);
  await streamPipeline(resp.body, fs.createWriteStream(`./images/${fileName}`));
}
