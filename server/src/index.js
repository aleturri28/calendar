import 'dotenv/config';
import { createApp } from './app.js';

const port = process.env.PORT || 3000;
createApp().listen(port, () => {
  console.log(`listening on ${port}`);
});
