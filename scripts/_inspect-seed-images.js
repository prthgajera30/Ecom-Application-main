const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '..', 'apps', 'api', 'src', 'seeding.ts');
const text = fs.readFileSync(file, 'utf8');
const lines = text.split(/\r?\n/);

const products = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  const slugMatch = line.match(/\bslug:\s*['"]([\w-]+)['"]/);
  if (slugMatch) {
    const slug = slugMatch[1];
    let j = i;
    let images = [];
    while (j < Math.min(lines.length, i + 200)) {
      const l = lines[j];
      const imagesStart = l.match(/\bimages:\s*\[/);
      if (imagesStart) {
        let k = j + 1;
        let acc = [];
        while (k < lines.length) {
          const lineK = lines[k].trim();
          const urlMatch = lineK.match(/['"](https?:\/\/[^'\"]+)['"]/);
          if (urlMatch) acc.push(urlMatch[1]);
          if (lineK.includes(']')) break;
          k++;
        }
        images = acc;
        break;
      }
      j++;
    }
    products.push({ slug, images });
    i = j;
  }
  i++;
}

// report
console.log('slug,count,first3');
for (const p of products) {
  console.log(`${p.slug},${p.images.length},${p.images.slice(0,3).join(' | ')}`);
}

console.log(`total products: ${products.length}`);
