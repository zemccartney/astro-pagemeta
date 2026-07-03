const url = new URL(globalThis.window.location.href);

const isPreview = url.searchParams.has("og-img");

if (isPreview) {
    const searchParams = new URLSearchParams();
    searchParams.append("route", url.pathname);
    globalThis.window.location.replace("/og?" + searchParams.toString());
}
