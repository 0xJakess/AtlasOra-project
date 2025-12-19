export default function resolveURL(url) {
  if (!url) return '';
  // Check if the URL is already absolute (starts with http or https)
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  //todo if url is blank return the default image set it in an env var
  return `${import.meta.env.VITE_APP_ADMIN_URL}${url}`;
}
