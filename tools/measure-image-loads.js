const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const url = process.argv[2] || 'http://localhost:3000/products';
  console.log('Loading', url);

  await page.goto(url, { waitUntil: 'networkidle' });

  const imgTimings = await page.evaluate(() => {
    return Array.from(document.images).map((img) => {
      const perf = performance.getEntriesByType('resource').find(e => e.name === img.currentSrc || e.name === img.src);
      return {
        src: img.src,
        currentSrc: img.currentSrc,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        resourceTiming: perf ? { startTime: perf.startTime, duration: perf.duration } : null,
      };
    });
  });

  console.log('Found', imgTimings.length, 'images');
  imgTimings.forEach((t) => console.log(JSON.stringify(t)));

  await browser.close();
})();
