export default function(e, c, n) {
    if (n.pathname === 'page-1') {
        return new Promise(res => {
            setTimeout(() => {
                res({});
            }, 4000);
        });
    }
    if (!n.pathname || ['page-3', 'page-4'].includes(n.pathname)) {
        return {};
    }
    if (n.pathname === 'page-5') {
        return new e.Response(null, { status: 302, headers: { Location: '/page-4/subpage', } });
    }
    if (n.stepname) return n();
}