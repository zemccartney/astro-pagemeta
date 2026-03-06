import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
    return new Response(
        '<!doctype html><html><head><meta charset="utf-8" /></head><body><p>HTML from endpoint</p></body></html>',
        { headers: { "Content-Type": "text/html" } }
    );
};
