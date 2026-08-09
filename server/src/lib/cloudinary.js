import { v2 as cloudinary } from 'cloudinary';

// La SDK legge da sé CLOUDINARY_URL; risolvere alla chiamata, non all'import,
// perché i test impostano la variabile dopo il caricamento dei moduli.
function config() {
  return cloudinary.config();
}

// Una CLOUDINARY_URL malformata non fallisce all'avvio: fallisce molto più
// tardi, dentro il browser, con un errore generico di upload. Meglio scoprirlo
// subito e dire esattamente cosa c'è che non va.
export function findConfigProblem(url = process.env.CLOUDINARY_URL) {
  if (!url) return 'CLOUDINARY_URL mancante in .env';
  if (/[<>]/.test(url)) {
    return 'CLOUDINARY_URL contiene < o >: togli le parentesi del template attorno a chiave e segreto';
  }
  if (!/^cloudinary:\/\/[^:@/]+:[^@/]+@[^@/]+$/.test(url)) {
    return 'CLOUDINARY_URL non ha la forma cloudinary://api_key:api_secret@cloud_name';
  }
  return null;
}

export function signUpload({ publicId }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, timestamp, overwrite: true, invalidate: true };
  const signature = cloudinary.utils.api_sign_request(params, config().api_secret);

  return {
    cloudName: config().cloud_name,
    apiKey: config().api_key,
    publicId,
    timestamp,
    overwrite: true,
    invalidate: true,
    signature,
  };
}

export function fetchResource(publicId, resourceType) {
  return cloudinary.api.resource(publicId, { resource_type: resourceType });
}

export function destroyResource(publicId, resourceType) {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
}
