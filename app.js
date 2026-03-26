//const API_KEY = "AIzaSyAUP7RiJd68TkSIg8TfN12R4CZR237Qa5g"; 
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import EPub from 'epub';

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gemini
const API_KEY = 'AIzaSyAUP7RiJd68TkSIg8TfN12R4CZR237Qa5g';
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

// EPUB
const epubPath = path.join(__dirname, 'OH-TOR07TA.epub');

// A keresett konkrét lecke címe
const keresettFejezetCim = 'A nemzeti eszme és a birodalmak kora';

let aktivFejezet = {
  cim: '',
  szoveg: ''
};

let konyvBetoltve = false;

async function betoltKeresettFejezetet() {
  try {
    const epub = new EPub(epubPath);
    await epub.parse();

    console.log('EPUB betöltve, keresett fejezet keresése...');

    const keresettAlso = keresettFejezetCim.toLowerCase();
    const blokkok = [];

    for (let i = 0; i < epub.flow.length; i++) {
      const chapter = epub.flow[i];

      try {
        const text = await epub.getChapter(chapter.id);
        if (!text) continue;

        const tisztitott = text
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (!tisztitott) continue;

        blokkok.push({
          cim: chapter.title || '',
          szoveg: tisztitott
        });
      } catch (err) {
        console.error(`Fejezet olvasási hiba (${chapter.id}):`, err);
      }
    }

    let startIndex = -1;

    for (let i = 0; i < blokkok.length; i++) {
      const blokk = blokkok[i];
      const cimAlso = blokk.cim.toLowerCase();
      const szovegAlso = blokk.szoveg.toLowerCase();

      const tartalomBlokk =
        cimAlso.includes('tartalom') ||
        szovegAlso.startsWith('tartalom ') ||
        szovegAlso.includes(' tartalom ');

      if (tartalomBlokk) {
        console.log('Kihagyva (tartalomjegyzék):', blokk.cim || '[nincs cím]');
        continue;
      }

      if (
        cimAlso.includes(keresettAlso) ||
        szovegAlso.includes(keresettAlso)
      ) {
        startIndex = i;
        console.log('Megtalált valódi fejezet kezdete:', blokk.cim || '[nincs cím]');
        break;
      }
    }

    if (startIndex === -1) {
      console.log('Nem találtam meg a keresett fejezetcímet:', keresettFejezetCim);
      return;
    }

    let osszegyujtott = [];
    let osszHossz = 0;
    const maxKarakter = 15000;

    for (let i = startIndex; i < blokkok.length; i++) {
      const blokk = blokkok[i];

      const cimAlso = blokk.cim.toLowerCase();
      const szovegAlso = blokk.szoveg.toLowerCase();

      const tartalomBlokk =
        cimAlso.includes('tartalom') ||
        szovegAlso.startsWith('tartalom ') ||
        szovegAlso.includes(' tartalom ');

      if (tartalomBlokk) {
        continue;
      }

      osszegyujtott.push(blokk.szoveg);
      osszHossz += blokk.szoveg.length;

      if (osszHossz >= maxKarakter) {
        break;
      }
    }

    aktivFejezet = {
      cim: keresettFejezetCim,
      szoveg: osszegyujtott.join('\n\n')
    };

    konyvBetoltve = true;

    console.log('Keresett fejezet betöltve:', aktivFejezet.cim);
    console.log('Karakterhossz:', aktivFejezet.szoveg.length);
    console.log('Preview:', aktivFejezet.szoveg.substring(0, 500));
  } catch (err) {
    console.error('EPUB hiba:', err);
  }
}

betoltKeresettFejezetet();

app.get('/api/chapter', (req, res) => {
  res.json({
    chapterTitle: aktivFejezet.cim,
    length: aktivFejezet.szoveg.length,
    preview: aktivFejezet.szoveg.substring(0, 1000)
  });
});

app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: 'API él' });
});

app.post('/api/ping', (req, res) => {
  res.json({ ok: true, message: 'pong' });
});

app.post('/api/ask', async (req, res) => {
  try {
    const question = req.body?.question;

    if (!question) {
      return res.status(400).json({ error: 'Nincs kérdés' });
    }

    if (!konyvBetoltve) {
      return res.status(503).json({ error: 'A könyv még töltődik.' });
    }

    const kontextus = aktivFejezet.szoveg;

    const prompt = `
Az alábbi tankönyvi részlet alapján válaszolj röviden, érthetően, magyarul.
Csak a forrás alapján válaszolj.
Ha a válasz nem állapítható meg a forrásból, azt mondd meg.

FEJEZET:
${aktivFejezet.cim}

FORRÁS:
${kontextus}

KÉRDÉS:
${question}
    `;

    const start = Date.now();

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const elapsedMs = Date.now() - start;

    res.json({
      answer: text,
      chapterTitle: aktivFejezet.cim,
      elapsedMs
    });
  } catch (err) {
    console.error('Gemini hiba:', err);
    res.status(500).json({
      error: 'AI hiba történt.',
      details: err?.message || String(err)
    });
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Node fut: http://localhost:3000');
});