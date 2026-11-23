export const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const subjectNames = { chinese: '语文', math: '数学', english: '英语' };
export const gradeName = (g) => '〇一二三四五六'[g] + '年级';
export const termName = (t) => (t === 1 ? '上册' : '下册');
export const time = (n) => Math.floor(n / 60) + ':' + String(Math.floor(n % 60)).padStart(2, '0');
export const safeOfficial = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname.endsWith('.sh.smartedu.cn') ? u.href : '';
  } catch {
    return '';
  }
};
export const icon = (s) => {
  const art = {
    chinese:
      '<path d="M8 19q11-5 22 2 12-6 24-2v28q-12-4-24 2Q18 42 8 47z" fill="#fff2c8"/><path d="M30 21v27m-17-22 10 2m-10 5 10 2m12-6 11-2m-11 9 9-2" fill="none"/><path d="m37 17 7-12 4 2-7 12-5 4z" fill="#e1925c"/>',
    math: '<path d="m8 45 21-34 18 34z" fill="#f5c676"/><path d="m20 38 9-15 8 15z" fill="#e1efdc"/><path d="m42 15 9 2-6 32-9-2z" fill="#a4c7ae"/><path d="m43 23 5 1m-6 6 5 1m-7 6 5 1" fill="none"/>',
    english:
      '<path d="M7 12h36v25H23l-10 8v-8H7z" fill="#fff2d6"/><path d="M31 31h23v15h-5v7l-8-7H31z" fill="#b5b5d5"/><path d="m15 29 5-11 5 11m-8-4h6m8-5v9m0-6q9-4 6 4-5 5-6 0" fill="none"/>',
  };
  return (
    '<svg viewBox="0 0 60 60" aria-hidden="true"><g stroke="currentColor" color="' +
    { chinese: '#765031', math: '#396953', english: '#575982' }[s] +
    '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">' +
    art[s] +
    '</g></svg>'
  );
};
export async function api(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw Error('请求失败（' + response.status + '）');
  return response.json();
}
