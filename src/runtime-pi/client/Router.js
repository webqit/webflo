
/**
 * @imports
 */
import { path as Path } from '../util.js';
import _Router from '../Router.js';

/**
 * ---------------------------
 * The Router class
 * ---------------------------
 */
			
export default class Router extends _Router {

    async readTick(thisTick) {
        var routeTree = this.cx.layout;
        var routePaths = Object.keys(this.cx.layout);
        if (thisTick.trail) {
            thisTick.currentSegment = thisTick.destination[thisTick.trail.length];
            thisTick.currentSegmentOnFile = [ thisTick.currentSegment, '-' ].reduce((_segmentOnFile, _seg) => {
                if (_segmentOnFile.index) return _segmentOnFile;
                var _currentPath = `/${thisTick.trailOnFile.concat(_seg).join('/')}`;
                return routeTree[_currentPath] ? { seg: _seg, index: _currentPath } : (
                    routePaths.filter(p => p.startsWith(`${_currentPath}/`)).length ? { seg: _seg, dirExists: true } : _segmentOnFile
                );
            }, { seg: null });
            thisTick.trail.push(thisTick.currentSegment);
            thisTick.trailOnFile.push(thisTick.currentSegmentOnFile.seg);
            thisTick.exports = routeTree[thisTick.currentSegmentOnFile.index];
        } else {
            thisTick.trail = [];
            thisTick.trailOnFile = [];
            thisTick.currentSegmentOnFile = { index: '/' };
            thisTick.exports = routeTree['/'];
        }
        return thisTick;
    }

    finalizeHandlerContext(context, thisTick) {
        return context.dirname = thisTick.currentSegmentOnFile.index;
    }

    pathJoin(...args) {
        return Path.join(...args);
    }
};
