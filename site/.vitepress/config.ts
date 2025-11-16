import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid';

const config = {
    title: 'Webflo',
    description: 'A universal, standards-first web framework for building web-native apps.',
    themeConfig: {
        logo: false,
        siteTitle: 'Webflo',
        /*
        // Site logo
        logo: {
            src: '/img/brand/linked-ql-logo.png',
            height: 140
        },
        siteTitle: false,
        */
        socialLinks: [
            { icon: 'github', link: 'https://github.com/webqit/webflo' },
        ],
        nav: [
            { text: 'Docs', link: '/docs', activeMatch: '/docs' },
            { text: 'API', link: '/api', activeMatch: '/api/webflo-routing/handler' },
            { text: 'Guides', link: '/guides', activeMatch: '/guides' },
            { text: 'Examples', link: '/examples', activeMatch: '/examples' },
        ],
        sidebar: {
            '/': [
                {
                    text: 'Getting Started',
                    items: [
                        { text: 'Welcome', link: '/docs' },
                        { text: 'Quickstart', link: '/docs/getting-started' },
                    ]
                },
                {
                    text: 'Concepts',
                    items: [
                        { text: 'Concepts Overview', link: '/docs/concepts' },
                        { text: 'Webflo Routing', link: '/docs/concepts/routing' },
                        { text: 'Rendering', link: '/docs/concepts/rendering' },
                        { text: 'Templates', link: '/docs/concepts/templates' },
                        { text: 'State Management', link: '/docs/concepts/state' },
                        { text: 'Request/Response Lifecycle', link: '/docs/concepts/request-response' },
                        { text: 'Webflo Realtime', link: '/docs/concepts/realtime' },
                    ]
                },
                {
                    text: 'Advanced',
                    items: [
                        { text: 'Advanced Overview', link: '/docs/advanced' },
                        { text: 'Redirects', link: '/docs/advanced/redirects' },
                    ]
                },
                {
                    text: 'API Reference',
                    items: [
                        {
                            text: 'Webflo Routing',
                            collapsed: true,
                            items: [
                                { text: 'Handler', link: '/api/webflo-routing/handler' },
                                { text: 'HttpEvent', link: '/api/webflo-routing/HttpEvent' },
                                { text: 'next', link: '/api/webflo-routing/handler/next' },
                                { text: 'fetch', link: '/api/webflo-routing/handler/fetch' },
                            ]
                        },
                        {
                            text: 'Webflo Fetch',
                            collapsed: true,
                            items: [
                                { text: 'fetch', link: '/api/webflo-fetch/fetch' },
                                { text: 'Request', link: '/api/webflo-fetch/Request' },
                                { text: 'Response', link: '/api/webflo-fetch/Response' },
                                { text: 'LiveResponse', link: '/api/webflo-fetch/LiveResponse' },
                                { text: 'FormData', link: '/api/webflo-fetch/FormData' },
                                { text: 'Headers', link: '/api/webflo-fetch/Headers' },
                            ]
                        },
                        {
                            text: 'Webflo Messaging',
                            collapsed: true,
                            items: [
                                { text: 'MessageChannel', link: '/api/webflo-messaging/MessageChannel' },
                                { text: 'MessagePort', link: '/api/webflo-messaging/MessagePort' },
                                { text: 'MessageEvent', link: '/api/webflo-messaging/MessageEvent' },
                            ]
                        },
                    ]
                },
                {
                    text: 'Guides & Recipes',
                    items: [
                        { text: 'Tutorial: Todo App', link: '/guides/tutorial-1-todo' },
                        { text: 'Auth', link: '/guides/guide-auth' },
                        { text: 'File Upload', link: '/guides/guide-file-upload' },
                        { text: 'Service Worker', link: '/guides/guide-service-worker' },
                        { text: 'Streaming', link: '/recipes/streaming' },
                        { text: 'Realtime Patterns', link: '/recipes/realtime' },
                    ]
                },
                {
                    text: 'Examples',
                    items: [
                        { text: 'Web Example', link: '/examples/web' },
                        { text: 'PWA Example', link: '/examples/pwa' },
                    ]
                },
                {
                    text: 'Reference',
                    items: [
                        { text: 'CLI', link: '/reference/cli' },
                        { text: 'Config', link: '/reference/config' },
                        { text: 'Tools', link: '/reference/tools' },
                        { text: 'FAQ', link: '/faq' },
                        { text: 'Contributing', link: '/contributing' },
                    ]
                }
            ]
        },
        footer: {
            message: 'MIT Licensed',
            copyright: '© webqit'
        },
        search: {
            provider: 'local'
        },
    },
    head: [
        ['meta', { name: 'theme-color', content: '#0f172a' }]
    ],

    lang: 'en-US',
    base: '/',
    cleanUrls: true,
    appearance: 'force-dark',
    toc: { level: [1, 2] },
    markdown: {
        math: true,
        theme: 'material-theme-palenight',
    },
    ignoreDeadLinks: true,
};


export default withMermaid(
    defineConfig(config)
);
