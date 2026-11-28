// Бесплатный прокси для TMDB на Cloudflare Workers.
// Пропускает картинки (/t/p/...) и API (/3/...) и кеширует их на месяц.
export default {
  async fetch(req) {
    const u = new URL(req.url);
    let target;
    if (u.pathname.startsWith("/t/p/")) target = "https://image.tmdb.org" + u.pathname;
    else if (u.pathname.startsWith("/3/")) target = "https://api.themoviedb.org" + u.pathname + u.search;
    else return new Response("tmdb proxy ok", { headers: { "access-control-allow-origin": "*" } });
    const r = await fetch(target, { cf: { cacheEverything: true, cacheTtl: 2592000 } });
    const h = new Headers(r.headers);
    h.set("access-control-allow-origin", "*");
    h.set("cache-control", "public, max-age=2592000");
    return new Response(r.body, { status: r.status, headers: h });
  },
};
