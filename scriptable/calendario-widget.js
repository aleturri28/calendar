// Widget Scriptable per il calendario condiviso.
//
// Installazione, una volta per iPhone:
//  1. installa Scriptable dall'App Store;
//  2. crea un nuovo script, incolla questo file;
//  3. sostituisci BASE_URL e TOKEN qui sotto con i tuoi;
//  4. tieni premuto sulla schermata home → aggiungi widget → Scriptable,
//     e scegli questo script.
//
// Il widget legge soltanto: mostra la foto già caricata oggi. Non scatta
// niente e non carica niente.

const BASE_URL = 'https://nostro-calendario.vercel.app';
// Il valore è nel file .env del progetto, alla riga WIDGET_TOKEN.
const TOKEN = 'INCOLLA-QUI-IL-WIDGET_TOKEN';

const PAPER = new Color('#f7f0e4');
const INK = new Color('#3b3128');
const SOFT = new Color('#857566');

async function build() {
  const widget = new ListWidget();
  widget.backgroundColor = PAPER;
  widget.setPadding(12, 12, 12, 12);

  let data;
  try {
    const request = new Request(`${BASE_URL}/api/widget/today?token=${encodeURIComponent(TOKEN)}`);
    data = await request.loadJSON();
  } catch (error) {
    const line = widget.addText('Non raggiungibile');
    line.textColor = SOFT;
    line.font = Font.systemFont(12);
    return widget;
  }

  if (data.error) {
    const line = widget.addText(data.error === 'bad_token' ? 'Token non valido' : 'Widget spento');
    line.textColor = SOFT;
    line.font = Font.systemFont(12);
    return widget;
  }

  // Preferisce la foto dell'altro: il widget serve a vedere lei, non te.
  const withPhoto = data.people.filter((p) => p.thumb);
  const chosen = withPhoto[withPhoto.length - 1] ?? null;

  if (!chosen) {
    const title = widget.addText('Oggi ancora niente');
    title.textColor = INK;
    title.font = Font.mediumSystemFont(14);
    widget.addSpacer(4);
    const hint = widget.addText('Tocca per aggiungere la tua foto');
    hint.textColor = SOFT;
    hint.font = Font.systemFont(11);
  } else {
    const image = await new Request(chosen.thumb).loadImage();
    const view = widget.addImage(image);
    view.cornerRadius = 6;
    view.applyFillingContentMode();

    widget.addSpacer(6);
    const caption = widget.addText(chosen.name);
    caption.textColor = SOFT;
    caption.font = Font.systemFont(11);
  }

  widget.url = BASE_URL;
  widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  return widget;
}

const widget = await build();

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentSmall();
}

Script.complete();
