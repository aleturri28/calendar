import 'dotenv/config';
import { createApp } from './app.js';
import { findConfigProblem } from './lib/cloudinary.js';

const problem = findConfigProblem();
if (problem) {
  console.error(`Configurazione non valida: ${problem}`);
  process.exit(1);
}

const port = process.env.PORT || 3000;
createApp().listen(port, () => {
  console.log(`listening on ${port}`);
});
