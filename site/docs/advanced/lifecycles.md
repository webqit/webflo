# Webflo Lifecycles

A place to see all the various lifecycles


+ HttpEvent.signal aborts when
    + parent event's signal aborts
    + request's signal aborts
    + HttpEvent.abort() is called
    + handler returns, plus all handlers in subtree return; i.e. all handlers complete their lifecycle
+ root HttpEvent is aborted on any of the above or when Realtime closes

+ Realtime closes when
    + is closed from client
    + Httpevent.client's `navigation` event fires and is not default-prevented
    + root event completes its lifecycle

+ Quantum state and Generators auto end when
    + HttpEvent.signal aborts

