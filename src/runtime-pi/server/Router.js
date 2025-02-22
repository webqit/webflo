import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import { WebfloRouter } from '../WebfloRouter.js';
			
export class Router extends WebfloRouter {

    async readTick(thisTick) {
        thisTick = { ...thisTick };
        if (thisTick.trail) {
            thisTick.currentSegment = thisTick.destination[thisTick.trail.length];
            thisTick.currentSegmentOnFile = [ thisTick.currentSegment, '-' ].reduce((_segmentOnFile, _seg) => {
                if (_segmentOnFile.index) return _segmentOnFile;
                var _currentPath = thisTick.trailOnFile.concat(_seg).join('/'),
                    routeHandlerFile;
                return Fs.existsSync(routeHandlerFile = Path.join(this.cx.CWD, this.cx.layout.SERVER_DIR, _currentPath, 'server.js')) || Fs.existsSync(routeHandlerFile = Path.join(this.cx.CWD, this.cx.layout.SERVER_DIR, _currentPath, 'index.js'))
                    ? { seg: _seg, index: routeHandlerFile }
                    : (Fs.existsSync(Path.join(this.cx.CWD, this.cx.layout.SERVER_DIR, _currentPath)) ? { seg: _seg, dirExists: true } : _segmentOnFile);
            }, { seg: null });
            thisTick.trail = thisTick.trail.concat(thisTick.currentSegment);
            thisTick.trailOnFile = thisTick.trailOnFile.concat(thisTick.currentSegmentOnFile.seg);
            thisTick.exports = thisTick.currentSegmentOnFile.index ? await import(Url.pathToFileURL(thisTick.currentSegmentOnFile.index)) : undefined;
        } else {
            thisTick.trail = [];
            thisTick.trailOnFile = [];
            let routeHandlerFile;
            thisTick.currentSegmentOnFile = Fs.existsSync(routeHandlerFile = Path.join(this.cx.CWD, this.cx.layout.SERVER_DIR, 'server.js')) || Fs.existsSync(routeHandlerFile = Path.join(this.cx.CWD, this.cx.layout.SERVER_DIR, 'index.js'))
                ? { index: routeHandlerFile }
                : {};
            thisTick.exports = thisTick.currentSegmentOnFile.index
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
