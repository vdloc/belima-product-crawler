import puppeteer from "puppeteer";
import write from "write-file-utf8";

const baseURL =
  "https://www.flachkanalmarkt.de/BELIMO-Stellantriebe-Vertriebs-GmbH_s";
let data = [];
let pages = [];

async function init() {
  const browser = await puppeteer.launch();
  const pageProcessor = processPage(browser);
  const pageUrls = Array.from({ length: 1 }, (_, index) =>
    getPageURL(18 + index)
  );

  for await (const pageURL of pageUrls) {
    await pageProcessor(pageURL);
  }

  await write("output.csv", transformDataToCSV(data));
  await write("urls.json", JSON.stringify(pages));
  await browser.close();
}

const csvKeyMapping = [
  "URL",
  "Artikelnummer",
  "Produktname",
  "Preis Flachkanal",
  "Preis Ventilation",
  "Kurze Beschreibung",
  "Artikelbeschreibung",
  "Bild URL",
  "Manufactor",
  "Meta Title",
  "Meta Beschreibung",
];

function convertToCSV(arr) {
  const array = csvKeyMapping.concat(arr);

  return array
    .map((it) => {
      return Object.values(it).toString();
    })
    .join("\n");
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
        metaDesc = "",
      }
    ) =>
      `${csv}
${url},${sku},"${name}",${price1},${price2},"${shortDesc}","${longDesc}",${imgURL},${manufactor},"${metaTitle}",${metaDesc}`,
    "URL,Artikelnummer,Produktname,Preis Flachkanal,Preis Ventilation,Kurze Beschreibung,Artikelbeschreibung,Bild URL,Manufactor,Meta Title,Meta Beschreibung"
  );
}

function getPageURL(pageNo) {
  return baseURL + pageNo;
}

function getPrice2(price1) {
  const priceFloat = price1.replace(/\D/, ".");
  if (Number.isNaN(Number(priceFloat))) return price1;
  const price2 = Number(priceFloat) * 0.95;

  return price2.toFixed(2);
}

const processProduct = (browser) =>
  async function (url) {
    const page = await browser.newPage();
    await page.goto(url);
    const productData = {
      url,
      sku: "",
      name: "",
      price1: "",
      price2: "",
      shortDesc: "",
      longDesc: "",
      imgURL: "",
      manufactor: "Belimo",
      metaTitle: "",
      metaDesc: "",
    };
    productData.sku = await page.$eval(
      'span[itemprop="sku"]',
      (el) => `BE- ${el.textContent.trim()}`
    );
    productData.name = await page.$eval(
      'h1.product-title[itemprop="name"]',
      (el) => el.textContent.trim()
    );

    try {
      productData.price1 = await page.$eval('meta[itemprop="price"]', (el) =>
        el.getAttribute("content")
      );
    } catch (error) {
      productData.price1 = await page.$eval(".price_label", (el) =>
        el.textContent.trim()
      );
    }
    productData.price2 = getPrice2(productData.price1);
    productData.shortDesc = await page.$eval(".shortdesc", (el) =>
      el.textContent.trim()
    );
    productData.longDesc = await page.$eval(".desc > p", (el) =>
      el.innerHTML
        .replaceAll("\n", "")
        .replaceAll('"', "”")
        .trim()
        .replaceAll("<br>", "\n")
    );
    productData.metaTitle = productData.name;
    productData.imgURL = await page.$eval("img.product-image", (el) => el.src);

    data.push(productData);
    page.close();
  };

const processPage = (browser) => async (url) => {
  const page = await browser.newPage();
  const productProcessor = processProduct(browser);
  await page.goto(url);
  console.log("Page URL: ", url);
  const productCards = await page.$$(".product-wrapper");
  const productURLs = productCards.map(async (productCard) => {
    const url = await productCard.$eval('meta[itemprop="url"]', (el) =>
      el.getAttribute("content")
    );
    return url;
  });
  const urls = await Promise.all(productURLs);

  for await (const url of urls) {
    console.log("Product URL: ", url);
    await productProcessor(url);
  }

  pages.push(url);
  await page.close({ runBeforeUnload: true });
};

init();
