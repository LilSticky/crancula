import {encodeMp3} from './mp3-encode';
import type {Mp3EncoderMessage} from './mp3-encoder-message';

addEventListener('message', (event: MessageEvent<Float32Array>) => {
  const post = (message: Mp3EncoderMessage, transfer: Transferable[] = []) => postMessage(message, transfer);
  try {
    const bytes = encodeMp3(event.data, (progress) => post({progress}));
    post({bytes}, [bytes.buffer]);
  } catch (error: unknown) {
    post({error: error instanceof Error ? error.message : String(error)});
  }
});
