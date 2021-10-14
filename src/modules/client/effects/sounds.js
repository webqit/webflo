const context = new window.AudioContext();

export function playFile(filepath) {
  // see https://jakearchibald.com/2016/sounds-fun/
  // Fetch the file
  fetch(filepath)
    // Read it into memory as an arrayBuffer
    .then(response => response.arrayBuffer())
    // Turn it from mp3/aac/whatever into raw audio data
    .then(arrayBuffer => context.decodeAudioData(arrayBuffer))
    .then(audioBuffer => {
      // Now we're ready to play!
      const soundSource = context.createBufferSource();
      soundSource.buffer = audioBuffer;
      soundSource.connect(context.destination);
      soundSource.start();
    });
}

export function playSuccess() {
    const successNoise = context.createOscillator();
    successNoise.frequency = "600";
    successNoise.type = "sine";
    successNoise.frequency.exponentialRampToValueAtTime(800, context.currentTime + 0.05);
    successNoise.frequency.exponentialRampToValueAtTime(1000, context.currentTime + 0.15);

    successGain = context.createGain();
    successGain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);

    successFilter = context.createBiquadFilter("bandpass");
    successFilter.Q = 0.01;

    successNoise
        .connect(successFilter)
        .connect(successGain)
        .connect(context.destination);
    successNoise.start();
    successNoise.stop(context.currentTime + 0.2);
}

export function playError() {
    const errorNoise = context.createOscillator();
    errorNoise.frequency = "400";
    errorNoise.type = "sine";
    errorNoise.frequency.exponentialRampToValueAtTime(200, context.currentTime + 0.05);
    errorNoise.frequency.exponentialRampToValueAtTime(100, context.currentTime + 0.2);

    errorGain = context.createGain();
    errorGain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);

    errorNoise.connect(errorGain).connect(context.destination);
    errorNoise.start();
    errorNoise.stop(context.currentTime + 0.3);
}

let successButton = document.querySelector("#success");
successButton.addEventListener("click", function() {
  playFile('https://s3-us-west-2.amazonaws.com/s.cdpn.io/3/success.mp3');
});

let errorButton = document.querySelector("#error");
errorButton.addEventListener("click", function() {
  playFile('https://s3-us-west-2.amazonaws.com/s.cdpn.io/3/error.mp3');
});