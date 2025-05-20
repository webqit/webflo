import { WebfloRootClient1 } from './WebfloRootClient1.js';

const { Observer } = webqit;

export class WebfloRootClient2 extends WebfloRootClient1 {

	control() {
		// Detect source elements
		let navigationOrigins = [];
        // Capture all link-clicks
		const clickHandler = (e) => {
			if (!this._canIntercept(e) || e.defaultPrevented) return;
			let anchorEl = e.target.closest('a');
			if (!anchorEl || !anchorEl.href || anchorEl.target) return;
			navigationOrigins = [anchorEl, null, anchorEl.closest('[navigationcontext]')];
		};
        // Capture all form-submits
		const submitHandler = (e) => {
			if (!this._canIntercept(e) || e.defaultPrevented) return;
			navigationOrigins = [e.submitter, e.target.closest('form'), e.target.closest('[navigationcontext]')];
		};
		// Handle navigation event which happens after the above
		const navigateHandler = (e) => {
			if (!e.canIntercept || e.downloadRequest !== null) return;
			if (e.hashChange) {
				Observer.set(this.location, 'href', e.destination.url);
				return;
			}
			const { navigationType, destination, signal, formData, info, userInitiated } = e;
			if (formData && navigationOrigins[1]?.hasAttribute('webflo-no-intercept')) return;
			if (formData && (navigationOrigins[0] || {}).name) { formData.set(navigationOrigins[0].name, navigationOrigins[0].value); }
			// Navigation details
			const detail = {
				navigationType,
				navigationOrigins,
				destination,
				source: this.currentEntry(),
				userInitiated,
				info
			};
			navigationOrigins = [];
			// Traversal?
			// Push
			const url = new URL(destination.url, this.location.href);
			const init = {
				method: formData && 'POST' || 'GET',
				body: formData,
				signal
			};
			this.updateCurrentEntry({
				state: {
					...(this.currentEntry().getState() || {}),
					scrollPosition: [window.scrollX, window.scrollY],
				}
			});
			const runtime = this;
			e.intercept({
				scroll: 'after-transition',
				focusReset: 'after-transition',
				async handler() { await runtime.navigate(url, init, detail); },
			});
		};
		window.addEventListener('click', clickHandler);
		window.addEventListener('submit', submitHandler);
		window.navigation.addEventListener('navigate', navigateHandler);
        return () => {
            this.host.removeEventListener('click', clickHandler);
            this.host.removeEventListener('submit', submitHandler);
			window.navigation.removeEventListener('navigate', navigateHandler);
        };
	}

    reload(params) {
		return window.navigation.reload(params);
	}

	back() {
		return window.navigation.canGoBack && window.navigation.back();
	}

	forward() {
		return window.navigation.canGoForward && window.navigation.forward();
	}

	traverseTo(...args) {
		return window.navigation.traverseTo(...args);
	}

	entries() {
		return window.navigation.entries();
	}

	currentEntry() {
		return window.navigation.currentEntry;
	}

	async updateCurrentEntry(params, url = null) {
		if (!url || url === window.navigation.currentEntry.url) {
			window.navigation.updateCurrentEntry(params);
		} else { await window.navigation.navigate(url, { ...params, history: 'replace' }).committed; }
	}

	async push(url, state = {}) {
		if (typeof url === 'string' && url.startsWith('&')) { url = this.location.href.split('#')[0] + (this.location.href.includes('?') ? url : url.replace('&', '?')); }
		url = new URL(url, this.location.href);
		await window.navigation.navigate(url.href, state).committed;
		Observer.set(this.location, 'href', url.href);
	}
}