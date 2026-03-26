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
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('Hiányzik a GEMINI_API_KEY környezeti változó.');
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });



// EPUB
let aktivFejezet = {
  cim: 'Teszt fejezet',
  szoveg: `
"A nemzeti eszme és a birodalmak kora
Bonaparte Napóleon katonai vereségét követően a győztes nagyhatalmak – a Habsburg Birodalom, a poroszok
és az oroszok – arra törekedtek, hogy megteremtsék a dinasztikus alapokon nyugvó birodalmak
hatalmi egyensúlyát Európában. Nagy-Britannia számára is fontos volt a kontinentális erőegyensúly kialakítása.
A francia forradalom során azonban számos olyan eszme született, amely a 19. században új szervezőerőként
lépett fel, és megváltoztatta a politika és a nemzetközi kapcsolatok világát.
..Miért volt fontos korszakhatár 1789
és 1815 az európai történelemben?
..Melyek voltak az első ipari forradalom
legfontosabb találmányai?
. Lengyelország nemzeti
himnusza
„Nincs még veszve Lengyelország,
Míg mi meg nem haltunk,
Hogyha földünk elrabolták,
Visszaszerzi kardunk.
Fel, fel Dąbrowski,
Zászlódat bontsd ki!
Ha te vagy vezérünk,
Népünkhöz elérünk.”
Jan Henryk Dąbrowski lengyel tábornok
Bonaparte Napóleon hadaiban szervezett
egy lengyel légiót. Fő törekvése az volt,
hogy az oroszok, a poroszok és a Habsburgok
által 1795-ben feldarabolt Lengyelországnak
visszahozza a függetlenséget.
..Hogyan fejezi ki a lengyel himnusz szövege
az országot ért sorscsapást?
..Hogyan próbált reményt adni?
. A Himnusz és a Szózat
A Himnusz és a Szózat a 19. században
a nemzeti sorskérdések, a történelem és
a nemzeti megmaradás kérdéskörét tárgyalva
született meg.
..Olvasd el újra Kölcsey Ferenc és Vörösmarty
Mihály művét! Gondold végig,
és beszéljétek meg, hogyan jelenik
meg benne a nemzeti eszme, a történelmi
múltunk!
A nemzeti eszme kibontakozása
A nemzet (latinul natio) kifejezés alatt évszázadokon keresztül
a nemességet értették a rendi társadalmakban. Ez a
szemléletmód az újkorban átalakult. Először az 1789-es
francia forradalom során jelent meg egy új nemzeteszme,
amelyben mindenki része lett a francia nemzetnek, és mindenki
számára fontossá vált a nemzet szabadsága és megerősödése.
Mindemellett a nemzeti sorscsapások, illetve a
nemzet jövőjének féltése is életre hívta a nemzeti összetartozás
új érzését a korszakban. Ilyen volt például a 18. század
végén a nagyhatalmi szomszédjai által feldarabolt lengyel
nép körében a függetlenség ., valamint a reformkori Magyarországon
a nemzeti megújulás kérdése.
..Miért erősödött meg a nemzeti összetartozás érzése ebben az
időszakban?
A szabad egyénekből álló nemzet és a független, önálló
nemzetállam megteremtése más népek számára is vonzó
példává vált. Egyre többen vallották azt, hogy a nemzethez
való tartozás érzése az emberi élet alapvető értéke. Úgy gondolták,
hogy a saját nemzeti közösség felemelése és védelme
mindenkinek kötelessége, függetlenül az egyén társadalmi
helyzetétől, vallásától vagy politikai nézeteitől. Ezt az
eszmerendszert nevezzük nacionalizmusnak. A nemzeti
együvé tartozás érzésének kialakulásában általában fontos
szerepet játszott a közös nyelv és kultúra, a nemzetre jellemző
szokások ápolása, valamint a közösség által megőrzött
mítoszok és a közös történelem. Ekkoriban teremtődtek
meg a ma is ismert nemzeti jelképek: a nemzeti himnuszok,
címerek és zászlók. . A 19. században az összetartozás tudata
egyre inkább áthatotta az egymástól elkülönülten, régi
birodalmak keretei között élő népeket.
..Mit akartak kiharcolni más nemzetek is?
..Milyen tényezők erősítik a nemzeti érzés kialakulását?`
};

let konyvBetoltve = true;

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Node fut: http://0.0.0.0:${PORT}`);
});