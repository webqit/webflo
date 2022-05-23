# Webflo

<!-- BADGES/ -->

<span class="badge-npmversion"><a href="https://npmjs.org/package/@web-native-js/observables" title="View this project on NPM"><img src="https://img.shields.io/npm/v/@web-native-js/observables.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/@web-native-js/observables" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/@web-native-js/observables.svg" alt="NPM downloads" /></a></span>
<span class="badge-patreon"><a href="https://patreon.com/ox_harris" title="Donate to this project using Patreon"><img src="https://img.shields.io/badge/patreon-donate-yellow.svg" alt="Patreon donate button" /></a></span>

<!-- /BADGES -->

The execution model of functional programs is fundamentally different from how we like to think in a procedural model.
If I did the following:

let [ valueA, setValueA ] = createSignal(10);
let [ valueB, setValueB ] = createSignal();
createEffect(() => setValueB(valueA() * 2));

createEffect(() => console.log( valueB() ));

createEffect(() => {
    if (someCondition()) {
        setValueA(20);
    }    
});


createEffect(() => console.log( valueB() ));

You'll see now that I have two effect blocks reacting both ABOVE and BELOW the point of mutation.

Whereas if I did the same procedurally:

function** fn() {
    let a = 10;
    let b = a * 2;

    console.log(b);

    if (someCondition) {
        a = 20;
    }

    console.log(b);
}
fn();
fn.thread( [ 'someCondition' ] );

I'd expect only the console.log() expression BELOW the point of mutation to react. So, code within Subscript Functions don't just look procedural, but work procedurally.

function** fn() {
    let result = (a || b) && consequentExpr || alternateExpr;
}
fn();

@mathias
 
@tomayac
 
@domenic
 
@jaffathecake
 
@surma
  
@Paul_Kinlan
 
@paul_irish
 
@aerotwist
 
@jason_mayes
 
@sundarpichai
 
@ThomasOrTK
 
@GrannisWill