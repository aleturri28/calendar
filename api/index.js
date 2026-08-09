// Entry point serverless per Vercel. Ogni richiesta sotto /api viene
// riscritta qui e instradata da Express sul percorso originale.
import { createApp } from '../server/src/app.js';
import { findConfigProblem } from '../server/src/lib/cloudinary.js';

const problem = findConfigProblem();
if (problem) {
  // In serverless non si può uscire dal processo: registrare il motivo e
  // lasciare che le route di upload falliscano con un errore parlante.
  console.error(`Configurazione non valida: ${problem}`);
}

export default createApp();
