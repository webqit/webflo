
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
                return Fs.existsSync(routeHandlerFile = Path.join(this.layout.ROOT, this.layout.SERVER_DIR, _currentPath, 'index.js')) ? { seg: _seg, index: routeHandlerFile } : (
                    Fs.existsSync(Path.join(this.layout.ROOT, this.layout.SERVER_DIR, _currentPath)) ? { seg: _seg, dirExists: true } : _segmentOnFile
                );
            }, { seg: null });
            thisTick.trail.push(thisTick.currentSegment);
            thisTick.trailOnFile.push(thisTick.currentSegmentOnFile.seg);
            thisTick.exports = thisTick.currentSegmentOnFile.index ? await import(Url.pathToFileURL(thisTick.currentSegmentOnFile.index)) : undefined;
        } else {
            thisTick.trail = [];
            thisTick.trailOnFile = [];
            thisTick.currentSegmentOnFile = { index: Path.join(this.layout.ROOT, this.layout.SERVER_DIR, 'index.js') };
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
     * @param ServerNavigationEvent event
     * 
     * @return Promise
     */
    fetch(event) {
        var filename = event.url.pathname;
        var _filename = Path.join(this.layout.ROOT, this.layout.PUBLIC_DIR, decodeURIComponent(filename));
        var autoIndex;
        if (Fs.existsSync(_filename)) {
            // based on the URL path, extract the file extention. e.g. .js, .doc, ...
            var ext = Path.parse(filename).ext;
            // read file from file system
            return new Promise((resolve, reject) => {
                // if is a directory search for index file matching the extention
                if (!ext && Fs.lstatSync(_filename).isDirectory()) {
                    ext = '.html';
                    _filename += '/index' + ext;
                    autoIndex = 'index.html';
                    if (!Fs.existsSync(_filename)) {
                        resolve();
                        return;
                    }
                }
                Fs.readFile(_filename, function(err, data){
                    if (err) {
                        // To be thrown by caller
                        reject({
                            errorCode: 500,
                            error: 'Error reading static file: ' + filename + '.',
                        });
                    } else {

                        // if the file is found, set Content-type and send data
                        const type = Mime.lookup(ext);
                        resolve( new event.Response(data, {
                            headers: {
                                contentType: type === 'application/javascript' ? 'text/javascript' : type,
                                contentLength: Buffer.byteLength(data),
                            },
                            meta: {
                                filename: _filename,
                                static: true,
                                autoIndex,
                            }
                        } ) );
                        
                    }
                });
            });
        }
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
        var _filename = Path.join(this.layout.PUBLIC_DIR, '.', filename);
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
