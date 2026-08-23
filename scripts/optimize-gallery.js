import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE_DIR = 'C:/Antigravity/Gaia/gaia-site-antigravity/docs/Fotos Novas Gaia';
const OUTPUT_SITE_DIR = 'C:/Antigravity/Gaia/gaia-site-antigravity/public/media/site';
const OUTPUT_NOVAS_DIR = path.join(OUTPUT_SITE_DIR, 'novas');

if (!fs.existsSync(OUTPUT_NOVAS_DIR)) {
  fs.mkdirSync(OUTPUT_NOVAS_DIR, { recursive: true });
}

// Slug map for safe, clean URL filenames
const SLUG_MAP = {
  'Fachada 2.png': 'hero-fachada-2',
  'Entrada Gaia.png': 'entrada-gaia',
  'Fachada 1.png': 'fachada-1',
  'Fachada 3.png': 'fachada-3',
  'Fachada 4.png': 'fachada-4',
  'Jardim 1.png': 'jardim-1',
  'Jardim 2.png': 'jardim-2',
  'Jardim 3.png': 'jardim-3',
  'Área Externa 1.png': 'area-externa-1',
  'Área Externa 2.png': 'area-externa-2',
  'Área Externa 3.png': 'area-externa-3',
  'Refeitório.png': 'refeitorio',
  'Sala de Convivência 1.png': 'sala-convivencia-1',
  'Sala de Convivência 2.png': 'sala-convivencia-2',
  'Sala de Convivência 3 Piano.png': 'sala-convivencia-3-piano',
  'Sala.png': 'sala-estar',
  'Elevador.png': 'elevador',
  'Quarto Individual 1.png': 'quarto-individual-1',
  'Quarto Individual 2.png': 'quarto-individual-2',
  'Quarto Duplo 1-A.png': 'quarto-duplo-1-a',
  'Quarto Duplo 1-B.png': 'quarto-duplo-1-b',
  'Quarto Duplo 1-C.png': 'quarto-duplo-1-c',
  'Quarto Duplo 2.png': 'quarto-duplo-2'
};

async function processImages() {
  console.log('Processing 23 images from docs/Fotos Novas Gaia ...');
  const files = fs.readdirSync(SOURCE_DIR);
  console.log(`Found ${files.length} files.`);

  for (const filename of files) {
    const inputPath = path.join(SOURCE_DIR, filename);
    const slug = SLUG_MAP[filename];
    if (!slug) {
      console.warn(`No slug mapped for: "${filename}"`);
      continue;
    }

    if (filename === 'Fachada 2.png') {
      // Process Hero Banner
      console.log(`Processing HERO: ${filename} -> ${slug}`);
      await sharp(inputPath)
        .resize({ width: 1920, withoutEnlargement: true })
        .webp({ quality: 85, effort: 6 })
        .toFile(path.join(OUTPUT_SITE_DIR, `${slug}-1920.webp`));

      await sharp(inputPath)
        .resize({ width: 1280, withoutEnlargement: true })
        .webp({ quality: 85, effort: 6 })
        .toFile(path.join(OUTPUT_SITE_DIR, `${slug}-1280.webp`));

      await sharp(inputPath)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 85, effort: 6 })
        .toFile(path.join(OUTPUT_SITE_DIR, `${slug}-800.webp`));
    } else {
      // Process Gallery Image
      console.log(`Processing GALLERY: ${filename} -> ${slug}`);
      await sharp(inputPath)
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 85, effort: 6 })
        .toFile(path.join(OUTPUT_NOVAS_DIR, `${slug}-1600.webp`));

      await sharp(inputPath)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 85, effort: 6 })
        .toFile(path.join(OUTPUT_NOVAS_DIR, `${slug}-800.webp`));
    }
  }

  console.log('All images converted to high quality WebP successfully!');
}

processImages().catch(console.error);
