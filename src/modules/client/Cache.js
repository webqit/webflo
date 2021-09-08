
/**
 * @imports
 */

export function syncToCache(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    return caches.open(name)
        .then(cache => cache.put('http://session.temp', new Response(blob)));
}

export function syncFromCache(name, del = false) {
    return caches.open(name)
        .then(cache => cache.match('http://session.temp')
        .then(response => response ? response.json() : null))
        .then(async data => (del ? await caches.delete(name) : null, data)).catch(e => null);
}

/**
const sessionData = Object.keys(clientNavigationEvent.session)
    .reduce((obj, key) => (obj[key] = clientNavigationEvent.session[key], obj), {});
await syncToCache('$session', sessionData);
*/
/**
response.finally(async () => {
    // Sync session data from cache that may have been exposed by service-worker routers
    const sessionData = await syncFromCache('$session', true);
    if (!sessionData) return;
    const keysInCache = Object.keys(sessionData);
    _unique(Object.keys(clientNavigationEvent.session).concat(keysInCache)).forEach(key => {
        if (!keysInCache.includes(key)) {
            delete clientNavigationEvent.session[key];
        } else {
            clientNavigationEvent.session[key] = sessionData[key];
        }
    });
});
*/
