import { path as Path } from '../util-url.js';
import { WebfloRouter } from '../WebfloRouter.js';
			
export class Router extends WebfloRouter {

    async readTick(thisTick) {
        thisTick = { ...thisTick };
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
            thisTick.trail = thisTick.trail.concat(thisTick.currentSegment);
            thisTick.trailOnFile = thisTick.trailOnFile.concat(thisTick.currentSegmentOnFile.seg);
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
}
