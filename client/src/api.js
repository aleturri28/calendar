async function call(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `http_${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => call('GET', path),
  post: (path, body) => call('POST', path, body),
  put: (path, body) => call('PUT', path, body),
  del: (path) => call('DELETE', path),
};
