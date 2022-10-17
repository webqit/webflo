
/**
 * @imports
 */
import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import Mime from 'mime-types';
import _Router from '../Router.js';

/**
 * ---------------------------
 * The Router class
 * ---------------------------
 */
			
export default class Router extends _Router {

    async readTick(thisTick) {
        if (thisTick.trail) {
            thisTick.currentSegment = thisTick.destination[thisTick.trail.length];
            thisTick.currentSegmentOnFile = [ thisTick.currentSegment, '-' ].reduce((_segmentOnFile, _seg) => {
                if (_segmentOnFile.index) return _segmentOnFile;
                var _currentPath = thisTick.trailOnFile.concat(_seg).join('/'),
                    routeHandlerFile;
                return Fs.existsSync(routeHandlerFile = Path.join(this.cx.CWD, this.cx.layout.SERVER_DIR, _currentPath, 'index.js')) ? { seg: _seg, index: routeHandlerFile } : (
                    Fs.existsSync(Path.join(this.cx.CWD, this.cx.layout.SERVER_DIR, _currentPath)) ? { seg: _seg, dirExists: true } : _segmentOnFile
                );
            }, { seg: null });
            thisTick.trail.push(thisTick.currentSegment);
            thisTick.trailOnFile.push(thisTick.currentSegmentOnFile.seg);
            thisTick.exports = thisTick.currentSegmentOnFile.index ? await import(Url.pathToFileURL(thisTick.currentSegmentOnFile.index)) : undefined;
        } else {
            thisTick.trail = [];
            thisTick.trailOnFile = [];
            thisTick.currentSegmentOnFile = { index: Path.join(this.cx.CWD, this.cx.layout.SERVER_DIR, 'index.js') };
            thisTick.exports = Fs.existsSync(thisTick.currentSegmentOnFile.index) 
                ? await import(Url.pathToFileURL(thisTick.currentSegmentOnFile.index)) 
                : null;
        }
        return thisTick;
    }

    finalizeHandlerContext(context, thisTick) {
        if (thisTick.currentSegmentOnFile.index) {
            context.dirname = Path.dirname(thisTick.currentSegmentOnFile.index);
        }
    }

    pathJoin(...args) {
        return Path.join(...args);
    }

    /**
     * Reads a static file from the public directory.
     * 
     * @param ServerNavigationEvent httpEvent
     * 
     * @return Promise
     */
    file(httpEvent) {
        let filename = Path.join(this.cx.CWD, this.cx.layout.PUBLIC_DIR, decodeURIComponent(httpEvent.url.pathname));
        let index, ext = Path.parse(httpEvent.url.pathname).ext;
        // if is a directory search for index file matching the extention
        if (!ext && Fs.existsSync(filename) && Fs.lstatSync(filename).isDirectory()) {
            ext = '.html';
            index = `index${ext}`;
            filename = Path.join(filename, index);
        }
        let enc, acceptEncs = [], supportedEncs = { gzip: '.gz', br: '.br' };
        // based on the URL path, extract the file extention. e.g. .js, .doc, ...
        // and process encoding
        if ((acceptEncs = (httpEvent.request.headers.get('Accept-Encoding') || '').split(',').map(e => e.trim())).length
        && (enc = acceptEncs.reduce((prev, _enc) => prev || (Fs.existsSync(filename + supportedEncs[_enc]) && _enc), null))) {
            filename = filename + supportedEncs[enc];
        } else {
            if (!Fs.existsSync(filename)) return;
            if (Object.values(supportedEncs).includes(ext)) {
                enc = Object.keys(supportedEncs).reduce((prev, _enc) => prev || (supportedEncs[_enc] === ext && _enc), null);
                ext = Path.parse(filename.substring(0, filename.length - ext.length)).ext;
            }
        }

        // read file from file system
        return new Promise(resolve => {
            Fs.readFile(filename, function(err, data) {
                let response;
                if (err) {
                    response = new httpEvent.Response(null, { status: 500, statusText: `Error reading static file: ${filename}` } );
                } else {
                    // if the file is found, set Content-type and send data
                    let mime = Mime.lookup(ext);
                    response = new httpEvent.Response(data, { headers: {
                        contentType: mime === 'application/javascript' ? 'text/javascript' : mime,
                        contentLength: Buffer.byteLength(data),
                    } });
                    if (enc) {
                        response.headers.set('Content-Encoding', enc);
                    }
                }
                response.attrs.filename = filename;
                response.attrs.static = true;
                response.attrs.index = index;
                resolve(response);
            });
        });
    }

    /**
     * Writes a file to the public directory.
     * 
     * @param object filename
     * @param string content
     * 
     * @return bool
     */
    putPreRendered(filename, content) {
        var _filename = Path.join(this.cx.layout.PUBLIC_DIR, '.', filename);
        if (!Path.parse(filename).ext && filename.lastIndexOf('.') < filename.lastIndexOf('/')) {
            _filename = Path.join(_filename, '/index.html');
        }
        var dir = Path.dirname(_filename);
        if (!Fs.existsSync(dir)) {
            Fs.mkdirSync(dir, {recursive:true});
        }
        return Fs.writeFileSync(_filename, content);
    }

    /**
     * Deletes a file from the public directory.
     * 
     * @param object filename
     * 
     * @return bool
     */
    deletePreRendered(filename) {
        return Fs.unlinkSync(filename);
    }
};

// maps file extention to MIME typere
const mimeTypes = {
    '.ico':     'image/x-icon',
    '.html':    'text/html',
    '.js':      'text/javascript',
    '.json':    'application/json',
    '.css':     'text/css',
    '.png':     'image/png',
    '.jpeg':     'image/jpeg',
    '.jpg':     'image/jpeg',
    '.wav':     'audio/wav',
    '.mp3':     'audio/mpeg',
    '.svg':     'image/svg+xml',
    '.pdf':     'application/pdf',
    '.doc':     'application/msword'
};

export { mimeTypes };
