export default function(e, c, n) {
    if (n.stepname && n.stepname !== 'page-1') return n();
    return new Promise(res => {
        setTimeout(() => {
            res({});
        }, 4000);
    });
}