export const ClientPortMixin = (superClass) => class extends superClass {

    async query(query, callback, options = {}) {
        return await new Promise((resolve) => {
            this.postRequest(
                { query },
                (event) => resolve(callback ? callback(event) : event),
                { ...options, type: 'query' }
            );
        });
    }

};