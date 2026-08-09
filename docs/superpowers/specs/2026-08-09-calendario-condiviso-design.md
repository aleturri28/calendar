# Design — Calendario condiviso a distanza

**Data**: 2026-08-09
**Stato**: approvato, pronto per il piano di implementazione

## Obiettivo

App web per due persone separate per ~6 mesi. Ogni giorno ognuno carica una foto e un
video; il video deve durare almeno quanto il minimo che l'**altro** ha impostato per quel
giorno. Il calendario mensile mostra a colpo d'occhio chi ha caricato cosa. A fine percorso
il risultato è un album/piccolo film del periodo.

Solo 2 utenti fissi. Niente registrazione, niente feed, niente like.

## Decisioni prese

| Tema | Decisione |
|---|---|
| Inizio calendario | 2026-08-09. Nessun giorno precedente esiste. |
| Finestra di upload | Oggi + 7 giorni indietro. Oltre, il giorno è congelato. |
| Modifica entro la finestra | Consentita: sovrascrittura semplice, nessuno storico. |
| Ritardi | Un contenuto caricato dopo il suo giorno è marcato "in ritardo". |
| Durata minima video | La imposta **l'altro utente**, in anticipo. Default 30s. |
| Video sotto il minimo | Upload bloccato, non un avviso. |
| Fuso orario | `Europe/Rome` fisso per entrambi (Italia e Palma sono nello stesso fuso). |
| Eventi | Singoli e multi-giorno, con flag `isMeetup` e countdown al prossimo incontro. |
| Hosting | Railway, servizio unico, volume persistente. |
| Upload | Diretto browser → Cloudinary con firma; il server verifica a posteriori. |
| Sessione | JWT in cookie `httpOnly`, 180 giorni. |

## Cosa entra in questo giro

Login, calendario mensile, upload foto+video con minimo impostato dall'altro, vista giorno.

Gli **eventi** entrano nello schema del database ora — così la migrazione si fa una volta
sola — ma le loro route e la loro UI arrivano nel giro successivo. Motivo: il calendario
parte oggi e la finestra di recupero è di 7 giorni, quindi ogni giorno senza app funzionante
è un giorno perso per sempre. Un evento invece lo si aggiunge quando l'app c'è già.

Fuori scope in questo giro: commenti, riepilogo mensile, widget Scriptable, design pass
completo (palette/polaroid).

## Architettura

Un solo servizio: Express serve le API sotto `/api` e il build statico di React per
tutto il resto. Nessun CORS, un solo dominio, un solo deploy.

```
calendar/
  server/
    src/
      index.js          bootstrap, static, error handler
      routes/           auth.js, calendar.js, days.js
      lib/              db.js, auth.js, cloudinary.js, dates.js
    test/
  client/
    src/
      api.js
      pages/            Login.jsx, Month.jsx, Day.jsx
      components/       CalendarGrid.jsx, DayCell.jsx, UploadSlot.jsx
  prisma/
    schema.prisma
    seed.js
```

In produzione il volume Railway è montato su `/data` e `DATABASE_URL=file:/data/app.db`,
così il database sopravvive ai deploy. In locale è `file:./dev.db`.

### Perché non Vercel

Il filesystem delle serverless function è effimero: un file SQLite lì viene perso a ogni
deploy. In più il limite di 4.5MB sul body di una request rende impossibile qualunque
upload che passi dal backend, e i video da iPhone pesano decine o centinaia di MB.
Railway con volume risolve entrambi senza aggiungere servizi esterni.

## Modello dati

```prisma
User {
  id           Int      @id @default(autoincrement())
  name         String   @unique
  passwordHash String
}

DayEntry {
  id              Int      @id @default(autoincrement())
  date            String   // "YYYY-MM-DD", Europe/Rome
  userId          Int
  minDuration     Int      @default(30)  // secondi, scritto dall'ALTRO utente
  photoUrl        String?
  photoPublicId   String?
  photoUploadedAt DateTime?
  videoUrl        String?
  videoPublicId   String?
  videoDuration   Float?   // secondi reali, letti da Cloudinary
  videoUploadedAt DateTime?
  createdAt       DateTime @default(now())
  @@unique([date, userId])
}

Event {
  id          Int      @id @default(autoincrement())
  title       String
  emoji       String?
  startDate   String   // "YYYY-MM-DD"
  endDate     String   // uguale a startDate se evento di un giorno
  isMeetup    Boolean  @default(false)
  createdById Int
}
```

Note sulle scelte:

- `date` è una stringa `YYYY-MM-DD` e tutti i confronti sono tra stringhe. Nessuna
  aritmetica su timestamp UTC, quindi nessun off-by-one intorno a mezzanotte.
- Non esiste un campo `isLate`. Si deriva confrontando `photoUploadedAt` (o
  `videoUploadedAt`) con la fine del giorno `date` in `Europe/Rome`. Così una foto puntuale
  e un video caricato due giorni dopo restano distinti, senza flag ridondanti da mantenere
  in sincrono.
- `minDuration` sta sul DayEntry del **destinatario** e lo scrive l'altro utente. La riga
  nasce alla prima delle due azioni che capita: l'altro imposta il minimo, oppure tu carichi.

### Stati della cella del calendario

- `completo` — entrambi avete foto **e** video.
- `parziale` — c'è qualcosa ma manca qualcosa.
- `vuoto` — niente.

Un giorno chiuso da oltre 7 giorni resta congelato nello stato in cui si trova.

## Flusso di upload

1. **Scelta file.** Il browser legge la durata dai metadati del video. Sotto il minimo,
   blocco immediato: nessuna richiesta parte.
2. **Firma.** `POST /api/days/:date/signature` con `{kind}`. Il server verifica sessione e
   finestra dei 7 giorni, poi firma `public_id = calendar/{date}/{userId}-{kind}` con
   `overwrite: true` e `invalidate: true`. La sostituzione è gratis: stesso `public_id`, il
   file precedente viene rimpiazzato.
3. **Upload diretto.** Il browser fa POST del file a
   `https://api.cloudinary.com/v1_1/{cloud}/{image|video}/upload`. Il file non tocca il
   backend: nessun limite di body, nessun doppio transito di rete.
4. **Conferma.** `POST /api/days/:date/confirm` con `{kind, publicId}`. Il server
   interroga l'Admin API di Cloudinary, legge `secure_url` e `duration` **reali** e solo
   allora fa l'upsert della riga.

Il punto 4 è ciò che rende il flusso sicuro: il client non fornisce mai un URL o una durata
che il server accetti sulla fiducia. Il controllo client-side del punto 1 esiste solo per
l'esperienza d'uso.

Un preset **unsigned** sarebbe stato più semplice ma inaccettabile: chiunque scopra il nome
del preset può caricare sull'account Cloudinary a spese del proprietario.

## API

```
POST /api/auth/login          {name, password} → set-cookie
POST /api/auth/logout
GET  /api/auth/me             → utente corrente

GET  /api/calendar/:month     "YYYY-MM" → stato di ogni giorno del mese
GET  /api/days/:date          → contenuti di entrambi + il tuo minimo + finestra aperta?
POST /api/days/:date/signature   {kind: "photo"|"video"}
POST /api/days/:date/confirm     {kind, publicId}
PUT  /api/days/:date/min-duration {seconds} → scrive sul DayEntry dell'ALTRO utente
```

### Errori

| Caso | Codice |
|---|---|
| Non autenticato | 401 |
| Giorno fuori dalla finestra dei 7 giorni, o nel futuro | 403 |
| Tentativo di impostare il minimo a sé stessi | 403 |
| Durata reale sotto il minimo (al confirm) | 422 |
| `publicId` inesistente su Cloudinary | 404 |
| `minDuration` fuori da 5–600 secondi | 400 |

Sul 422 il server **cancella la risorsa da Cloudinary** prima di rispondere, così un video
rifiutato non resta orfano a consumare quota.

## Autenticazione

Due account creati dal seed a partire da `.env`; password hashate con bcrypt (cost 12).
Il seed fallisce con un errore esplicito se le password non sono valorizzate, e può essere
rilanciato per aggiornare le password senza toccare i DayEntry.

Sessione: JWT firmato con `JWT_SECRET`, in cookie `httpOnly` + `SameSite=Lax`, `Secure` in
produzione, scadenza 180 giorni — copre l'intero percorso senza mai rifare login da iPhone.

## Test

Vitest + supertest sulle route, Cloudinary mockato, SQLite su file temporaneo per test.

Priorità ai casi dove un bug fa danno silenzioso:

- upload rifiutato fuori dalla finestra dei 7 giorni e per date future;
- `confirm` che rifiuta un video la cui durata reale è sotto il minimo, anche quando il
  client dichiara il contrario, e che cancella la risorsa;
- `min-duration` scritto solo sul DayEntry dell'altro utente, mai sul proprio;
- calcolo di "in ritardo" a cavallo della mezzanotte in `Europe/Rome`;
- `signature` che rifiuta le richieste non autenticate.

Sul client, uno smoke test sul rendering degli stati della griglia.

## Variabili d'ambiente

| Variabile | Note |
|---|---|
| `CLOUDINARY_URL` | già presente |
| `DATABASE_URL` | già presente; in produzione `file:/data/app.db` |
| `JWT_SECRET` | già presente |
| `USER_A_NAME`, `USER_A_PASSWORD` | account 1 |
| `USER_B_NAME`, `USER_B_PASSWORD` | account 2 |

`.env` è in `.gitignore`. Un `.env.example` con le sole chiavi viene committato.

## Giri successivi

1. Design pass: palette calda, font serif, estetica polaroid, micro-animazioni.
2. Eventi: route, UI, countdown al prossimo `isMeetup`.
3. Commenti brevi sotto ogni post.
4. Riepilogo mensile automatico (collage + streak).
5. Widget Scriptable su `/api/widget/today`.
