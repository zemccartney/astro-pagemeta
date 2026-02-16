import { middleware } from "@grepco/astro-pagemeta/runtime";
import { defineMiddleware, sequence } from "astro:middleware";

const custom = defineMiddleware(async (context, next) => {
    const response = await next();

    if (context.url.pathname === "/custom") {
        const html = await response.text();
        return new Response(
            html.replace(
                "</head>",
                '        <meta name="robots" content="index, follow">\n    </head>'
            ),
            {
                headers: response.headers,
                status: response.status
            }
        );
    }

    return response;
});

export const onRequest = sequence(custom, middleware());
