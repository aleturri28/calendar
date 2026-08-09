// Widget Scriptable per il calendario condiviso.
//
// Mostra l'ultima foto caricata dall'ALTRA persona: sul telefono di Alessandro
// compare Anna, su quello di Anna compare Alessandro. Legge soltanto, non
// scatta e non carica niente.
//
// Installazione, una volta per iPhone:
//  1. installa Scriptable dall'App Store;
//  2. crea un nuovo script e incolla questo file;
//  3. metti il tuo nome in IO e il token in TOKEN, qui sotto;
//  4. tieni premuto sulla schermata home → aggiungi widget → Scriptable,
//     e scegli questo script.

const BASE_URL = 'https://nostro-calendario.vercel.app';

// Il TUO nome, esattamente come compare nell'app. Sul telefono dell'altra
// persona va messo l'altro nome: è ciò che rende il widget speculare.
const IO = 'Alessandro';

// Il valore è nel file .env del progetto, alla riga WIDGET_TOKEN.
const TOKEN = 'INCOLLA-QUI-IL-WIDGET_TOKEN';

const PAPER = new Color('#f7f0e4');
const INK = new Color('#3b3128');
const SOFT = new Color('#857566');

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function giornoLeggibile(date) {
  const [, mese, giorno] = date.split('-');
  return `${Number(giorno)} ${MESI[Number(mese) - 1]}`;
}

function messaggio(widget, testo) {
  const line = widget.addText(testo);
  line.textColor = SOFT;
  line.font = Font.systemFont(12);
  line.centerAlignText();
}

async function build() {
  const widget = new ListWidget();
  widget.backgroundColor = PAPER;
  widget.setPadding(12, 12, 12, 12);
  widget.url = BASE_URL;
  // Suggerimento, non comando: iOS decide da sé quando risvegliare un widget,
  // in base alla batteria e a quanto lo si guarda. Chiedere più spesso del
  // necessario non lo velocizza, chiedere di rado invece lo rallenta.
  widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

  let data;
  try {
    const url = `${BASE_URL}/api/widget/latest`
      + `?token=${encodeURIComponent(TOKEN)}&as=${encodeURIComponent(IO)}`;
    data = await new Request(url).loadJSON();
  } catch (error) {
    messaggio(widget, 'Non raggiungibile');
    return widget;
  }

  if (data.error === 'bad_token') {
    messaggio(widget, 'Token non valido');
    return widget;
  }
  if (data.error === 'unknown_viewer' || data.error === 'missing_viewer') {
    messaggio(widget, `Nome "${IO}" non riconosciuto`);
    return widget;
  }
  if (data.error) {
    messaggio(widget, 'Widget spento');
    return widget;
  }

  if (!data.hasPhoto) {
    const title = widget.addText(`${data.from} non ha ancora caricato`);
    title.textColor = INK;
    title.font = Font.mediumSystemFont(13);
    title.centerAlignText();
    return widget;
  }

  const image = await new Request(data.thumb).loadImage();
  const view = widget.addImage(image);
  view.cornerRadius = 6;
  view.applyFillingContentMode();

  widget.addSpacer(6);

  const caption = widget.addText(
    data.isToday ? `${data.from} · oggi` : `${data.from} · ${giornoLeggibile(data.date)}`
  );
  caption.textColor = SOFT;
  caption.font = Font.systemFont(11);
  caption.centerAlignText();

  return widget;
}

const widget = await build();

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentSmall();
}

Script.complete();
