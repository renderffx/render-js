const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const stringToStream = (str: string): ReadableStream => {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(str));
      controller.close();
    },
  });
};

export const streamToBase64 = async (stream: ReadableStream): Promise<string> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    if (!(value instanceof Uint8Array)) {
      throw new Error('Unexpected buffer type');
    }
    chunks.push(value);
    totalSize += value.byteLength;
  }

  const combined = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return btoa(String.fromCharCode(...combined));
};

export const base64ToStream = (base64: string): ReadableStream => {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes]).stream();
};

function concatBuffers(chunks: readonly Uint8Array[]): Uint8Array {
  if (chunks.length === 1) {
    return chunks[0]!;
  }

  const total = chunks.reduce((n, chunk) => n + chunk.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}

export function batchReadableStream(
  input: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const buffer: Uint8Array[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = (controller: TransformStreamDefaultController<Uint8Array>): void => {
    clearTimeout(timer);
    timer = undefined;

    if (buffer.length === 0) {
      return;
    }

    try {
      controller.enqueue(concatBuffers(buffer));
    } catch {
      // ignore errors
    }

    buffer.length = 0;
  };

  return input.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        buffer.push(chunk);
        if (!timer) {
          timer = setTimeout(() => flush(controller));
        }
      },
      flush(controller) {
        flush(controller);
      },
    }),
  );
}

// Frame types for multiplexed streaming
const FRAME_START = 0x01;
const FRAME_CHUNK = 0x02;
const FRAME_END = 0x03;
const FRAME_ERROR = 0x04;

function writeFrameHeader(
  buffer: Uint8Array,
  frameType: number,
  key: string,
  payloadLength = 0,
): void {
  const keyBytes = encoder.encode(key);
  let offset = 0;

  buffer[offset++] = frameType;
  new DataView(buffer.buffer).setUint16(offset, keyBytes.length);
  offset += 2;
  buffer.set(keyBytes, offset);
  offset += keyBytes.length;

  if (payloadLength > 0) {
    new DataView(buffer.buffer).setUint32(offset, payloadLength);
  }
}

function encodeStart(key: string): Uint8Array {
  const keyBytes = encoder.encode(key);
  const buffer = new Uint8Array(1 + 2 + keyBytes.length);
  writeFrameHeader(buffer, FRAME_START, key);
  return buffer;
}

function encodeEnd(key: string): Uint8Array {
  const keyBytes = encoder.encode(key);
  const buffer = new Uint8Array(1 + 2 + keyBytes.length);
  writeFrameHeader(buffer, FRAME_END, key);
  return buffer;
}

function encodeChunk(key: string, chunk: Uint8Array): Uint8Array {
  const keyBytes = encoder.encode(key);
  const buffer = new Uint8Array(1 + 2 + keyBytes.length + 4 + chunk.length);
  writeFrameHeader(buffer, FRAME_CHUNK, key, chunk.length);
  buffer.set(chunk, 1 + 2 + keyBytes.length + 4);
  return buffer;
}

function encodeError(key: string, error: unknown): Uint8Array {
  const payload = encoder.encode(String(error));
  const keyBytes = encoder.encode(key);
  const buffer = new Uint8Array(1 + 2 + keyBytes.length + 4 + payload.length);
  writeFrameHeader(buffer, FRAME_ERROR, key, payload.length);
  buffer.set(payload, 1 + 2 + keyBytes.length + 4);
  return buffer;
}

type DispatcherCallbacks = {
  onStart: (key: string) => void;
  onChunk: (key: string, chunk: Uint8Array) => void;
  onEnd: (key: string) => void;
  onError: (key: string, error: string) => void;
};

function createFrameDispatcher(callbacks: DispatcherCallbacks) {
  let buffer = new Uint8Array(0) as Uint8Array;

  return (data: Uint8Array): void => {
    const merged = new Uint8Array(buffer.length + data.length);
    merged.set(buffer, 0);
    merged.set(data, buffer.length);
    buffer = merged;

    while (buffer.length > 0) {
      if (buffer.length < 3) {
        break;
      }

      const frameType = buffer[0]!;
      const view = new DataView(buffer.buffer, buffer.byteOffset);
      const keyLen = view.getUint16(1);
      const headerLen = 1 + 2 + keyLen;

      if (buffer.length < headerLen) {
        break;
      }

      const key = decoder.decode(buffer.slice(3, 3 + keyLen));

      if (frameType === FRAME_START) {
        callbacks.onStart(key);
        buffer = buffer.slice(headerLen);
        continue;
      }

      if (frameType === FRAME_END) {
        callbacks.onEnd(key);
        buffer = buffer.slice(headerLen);
        continue;
      }

      if (buffer.length < headerLen + 4) {
        break;
      }

      const payloadLen = view.getUint32(headerLen);
      const totalLen = headerLen + 4 + payloadLen;

      if (buffer.length < totalLen) {
        break;
      }

      const payload = buffer.slice(headerLen + 4, totalLen);

      if (frameType === FRAME_CHUNK) {
        callbacks.onChunk(key, payload);
      } else if (frameType === FRAME_ERROR) {
        callbacks.onError(key, decoder.decode(payload));
      } else {
        throw new Error(`Unknown frame type: ${frameType}`);
      }

      buffer = buffer.slice(totalLen);
    }
  };
}

export function produceMultiplexedStream(
  fn: (callback: (key: string, stream: ReadableStream) => Promise<void>) => Promise<void>,
): ReadableStream<Uint8Array> {
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const frameStream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const callback = async (key: string, stream: ReadableStream): Promise<void> => {
    controller.enqueue(encodeStart(key));

    const reader = stream.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (!(value instanceof Uint8Array)) {
          throw new Error('Unexpected buffer type');
        }
        controller.enqueue(encodeChunk(key, value));
      }
      controller.enqueue(encodeEnd(key));
    } catch (err) {
      controller.enqueue(encodeError(key, err));
    }
  };

  fn(callback).then(
    () => controller.close(),
    (err) => controller.error(err),
  );

  return frameStream;
}

export async function consumeMultiplexedStream(
  frameStream: ReadableStream<Uint8Array>,
  callback: (key: string, stream: ReadableStream<Uint8Array>) => Promise<void>,
): Promise<void> {
  const controllers = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
  const promises: Promise<void>[] = [];

  const dispatchFrame = createFrameDispatcher({
    onStart(key) {
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          controllers.set(key, c);
        },
      });
      promises.push(callback(key, stream));
    },
    onChunk(key, chunk) {
      controllers.get(key)?.enqueue(chunk);
    },
    onEnd(key) {
      controllers.get(key)?.close();
      controllers.delete(key);
    },
    onError(key, error) {
      controllers.get(key)?.error(error);
      controllers.delete(key);
    },
  });

  const reader = frameStream.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    dispatchFrame(value);
  }

  await Promise.all(promises);
}
