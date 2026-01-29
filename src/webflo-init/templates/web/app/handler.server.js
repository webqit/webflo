export default async function (event, next, fetch) {
    if (next.stepname) return await next();
    return {
        title: 'Webflo Web',
        greeting: 'Hello World!',
        menu: [{ title: 'Home', href: '/' }],
    };
}