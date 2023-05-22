import puppeteer from 'puppeteer';
import write from 'write-file-utf8';
import downloadImage from './images.js';

const baseURL =
  'https://www.flachkanalmarkt.de/BELIMO-Stellantriebe-Vertriebs-GmbH_s';
let data = [];
let pages = [];
const PAGES_COUNT = 94;
const START_PAGE = 1;

async function init() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const pageCrawler = createPageCrawler(browser);
  const pageUrls = Array.from({ length: PAGES_COUNT }, (_, index) =>
    getPageURL(START_PAGE + index)
  );

  for await (const pageURL of pageUrls) {
    await pageCrawler(pageURL);
  }

  await exportData();
  await browser.close();
}

async function exportData() {
  await write('output_1.csv', transformDataToCSV(data));
  await write('urls.json', JSON.stringify(pages));
  console.log('Exported data!');
}

function transformDataToCSV() {
  return data.reduce(
    (
      csv,
      {
        url,
        sku,
        name,
        price1,
        price2,
        shortDesc,
        longDesc,
        imgURL,
        manufactor,
        metaTitle,
        metaDesc = '',
      }
    ) =>
      `${csv}
${url},${sku},"${name}",${price1},${price2},"${shortDesc}","${longDesc}",${imgURL},${manufactor},"${metaTitle}",${metaDesc}`,
    'URL,Artikelnummer,Produktname,Preis Flachkanal,Preis Ventilation,Kurze Beschreibung,Artikelbeschreibung,Bild URL,Manufactor,Meta Title,Meta Beschreibung'
  );
}

function getPageURL(pageNo) {
  return baseURL + pageNo;
}

function getPrice2(price1) {
  const priceFloat = price1.replace(/\D/, '.');
  if (Number.isNaN(Number(priceFloat))) return price1;
  const price2 = Number(priceFloat) * 0.95;

  return price2.toFixed(2);
}

const createProductCrawler = (browser) =>
  async function (url) {
    const page = await browser.newPage();
    page.setDefaultTimeout(0);
    await page.goto(url);
    const productData = {
      url,
      sku: '',
      name: '',
      price1: '',
      price2: '',
      shortDesc: '',
      longDesc: '',
      imgURL: '',
      manufactor: 'Belimo',
      metaTitle: '',
      metaDesc: '',
    };
    productData.sku = await page.$eval(
      'span[itemprop="sku"]',
      (el) => `BE- ${el.textContent.trim()}`
    );
    productData.name = await page.$eval(
      'h1.product-title[itemprop="name"]',
      (el) => el.textContent.trim().replaceAll('"', '""')
    );
    try {
      productData.price1 = await page.$eval('meta[itemprop="price"]', (el) =>
        el.getAttribute('content')
      );
    } catch (error) {
      try {
        productData.price1 = await page.$eval('.price_label', (el) =>
          el.textContent.replace('€', '').trim()
        );
      } catch (error) {}
    }
    productData.price2 = getPrice2(productData.price1);
    productData.shortDesc = await page.$eval('.shortdesc', (el) =>
      el.textContent.trim().replaceAll('"', '""')
    );
    productData.longDesc = await page.$eval('.desc > p', (el) =>
      el.innerHTML
        .replaceAll('\n', '')
        .replaceAll('"', '”')
        .trim()
        .replaceAll('<br>', '\n')
    );
    productData.metaTitle = productData.name;
    productData.imgURL = await page.$eval('img.product-image', (el) =>
      el.src.replace('/xs/', '/lg/')
    );
    // await downloadImage(productData.imgURL);
    data.push(productData);
    page.close();
  };

const createPageCrawler = (browser) => async (url) => {
  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  const productCrawler = createProductCrawler(browser);
  try {
    await page.goto(url);
  } catch (error) {
    console.log(error);
    console.log('End of the adventure!!!');
    await exportData();
  }
  console.log('Page URL: ', url);
  const productCards = await page.$$('.product-wrapper');
  const productURLs = productCards.map(async (productCard) => {
    const url = await productCard.$eval('meta[itemprop="url"]', (el) =>
      el.getAttribute('content')
    );
    return url;
  });
  const urls = await Promise.all(productURLs);

  for await (const url of urls) {
    console.log('Product URL: ', url);
    await productCrawler(url);
  }

  pages.push(url);
  await page.close({ runBeforeUnload: true });
};

init();
