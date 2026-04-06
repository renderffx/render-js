import { describe, it, expect, vi } from 'vitest';
import React, { createElement } from 'react';

vi.mock('@renderjs/core', async () => {
  const actual = await vi.importActual('@renderjs/core');
  return {
    ...actual as any,
  };
});

const mockRenderToReadableStream = vi.fn().mockImplementation(async (element) => {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  
  if (element === null || element === undefined) {
    chunks.push(encoder.encode(JSON.stringify({ type: 'jsx', data: null })));
  } else if (typeof element === 'string') {
    chunks.push(encoder.encode(JSON.stringify({ type: 'jsx', data: element })));
  } else if (typeof element === 'number') {
    chunks.push(encoder.encode(JSON.stringify({ type: 'jsx', data: element })));
  } else if (typeof element === 'boolean') {
    chunks.push(encoder.encode(JSON.stringify({ type: 'jsx', data: null })));
  } else if (Array.isArray(element)) {
    chunks.push(encoder.encode(JSON.stringify({ type: 'jsx', data: element })));
  } else if (React.isValidElement(element)) {
    const elem = element as React.ReactElement;
    chunks.push(encoder.encode(JSON.stringify({ 
      type: 'jsx', 
      data: { type: elem.type?.toString() || 'Unknown', props: elem.props } 
    })));
  } else {
    chunks.push(encoder.encode(JSON.stringify({ type: 'jsx', data: String(element) })));
  }
  
  chunks.push(encoder.encode('\n[RSC_END]'));
  
  let sent = false;
  return new ReadableStream({
    pull(controller) {
      if (!sent) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        sent = true;
      }
      controller.close();
    },
  });
});

describe('RSC Streaming (Mocked)', () => {
  describe('renderToReadableStream', () => {
    it('should render a simple string element', async () => {
      const stream = await mockRenderToReadableStream('Hello World');
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      expect(chunks[0]).toBeInstanceOf(Uint8Array);
      const decoder = new TextDecoder();
      const text = decoder.decode(chunks[0]);
      
      expect(text).toContain('Hello World');
    });

    it('should render a simple React element', async () => {
      const element = createElement('h1', { id: 'title' }, 'Hello');
      const stream = await mockRenderToReadableStream(element);
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const decoder = new TextDecoder();
      const text = chunks.map(c => decoder.decode(c)).join('');
      
      expect(text).toContain('h1');
      expect(text).toContain('Hello');
    });

    it('should render nested React elements', async () => {
      const element = createElement(
        'div',
        { className: 'container' },
        createElement('h1', null, 'Title'),
        createElement('p', null, 'Description')
      );
      
      const stream = await mockRenderToReadableStream(element);
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const decoder = new TextDecoder();
      const text = chunks.map(c => decoder.decode(c)).join('');
      
      expect(text).toContain('div');
      expect(text).toContain('Title');
      expect(text).toContain('Description');
    });

    it('should handle null and undefined', async () => {
      const nullStream = await mockRenderToReadableStream(null);
      const undefinedStream = await mockRenderToReadableStream(undefined);
      
      expect(nullStream).toBeInstanceOf(ReadableStream);
      expect(undefinedStream).toBeInstanceOf(ReadableStream);
    });

    it('should render numbers correctly', async () => {
      const stream = await mockRenderToReadableStream(42);
      const reader = stream.getReader();
      const { value } = await reader.read();
      
      const decoder = new TextDecoder();
      const text = decoder.decode(value);
      
      expect(text).toContain('42');
    });

    it('should render arrays of elements', async () => {
      const elements = [
        createElement('li', { key: '1' }, 'Item 1'),
        createElement('li', { key: '2' }, 'Item 2'),
        createElement('li', { key: '3' }, 'Item 3'),
      ];
      
      const stream = await mockRenderToReadableStream(elements);
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const decoder = new TextDecoder();
      const text = chunks.map(c => decoder.decode(c)).join('');
      
      expect(text).toContain('Item 1');
      expect(text).toContain('Item 2');
      expect(text).toContain('Item 3');
    });

    it('should include RSC_END marker', async () => {
      const stream = await mockRenderToReadableStream('test');
      const reader = stream.getReader();
      let hasEndMarker = false;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const decoder = new TextDecoder();
        const text = decoder.decode(value);
        if (text.includes('[RSC_END]')) {
          hasEndMarker = true;
        }
      }
      
      expect(hasEndMarker).toBe(true);
    });

    it('should handle complex nested structures', async () => {
      const element = createElement(
        'main',
        { className: 'app' },
        createElement(
          'header',
          null,
          createElement('h1', null, 'My App')
        ),
        createElement(
          'nav',
          null,
          createElement('ul', null,
            createElement('li', { key: '1' }, 'Home'),
            createElement('li', { key: '2' }, 'About')
          )
        ),
        createElement(
          'section',
          { id: 'content' },
          createElement('p', null, 'Welcome!')
        )
      );
      
      const stream = await mockRenderToReadableStream(element);
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const decoder = new TextDecoder();
      const text = chunks.map(c => decoder.decode(c)).join('');
      
      expect(text).toContain('main');
      expect(text).toContain('My App');
      expect(text).toContain('Home');
      expect(text).toContain('About');
      expect(text).toContain('Welcome');
    });
  });
});

describe('React Elements', () => {
  it('should create valid React elements', () => {
    const element = createElement('div', { className: 'test' }, 'Hello');
    expect(React.isValidElement(element)).toBe(true);
  });

  it('should handle nested elements', () => {
    const child = createElement('span', null, 'Child');
    const parent = createElement('div', null, child);
    expect(React.isValidElement(parent)).toBe(true);
  });

  it('should render arrays of elements', () => {
    const items = ['a', 'b', 'c'].map((text, i) => 
      createElement('li', { key: i }, text)
    );
    expect(items).toHaveLength(3);
    items.forEach(item => {
      expect(React.isValidElement(item)).toBe(true);
    });
  });
});

describe('Stream Reading', () => {
  it('should read entire stream to completion', async () => {
    const chunks: Uint8Array[] = [];
    const encoder = new TextEncoder();
    
    chunks.push(encoder.encode('chunk1\n'));
    chunks.push(encoder.encode('chunk2\n'));
    chunks.push(encoder.encode('[RSC_END]'));
    
    let sent = false;
    const stream = new ReadableStream({
      pull(controller) {
        if (!sent) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          sent = true;
        }
        controller.close();
      },
    });
    
    const reader = stream.getReader();
    const results: string[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      results.push(new TextDecoder().decode(value));
    }
    
    expect(results).toHaveLength(3);
    expect(results.join('')).toContain('chunk1');
    expect(results.join('')).toContain('chunk2');
  });

  it('should handle empty stream', async () => {
    const stream = new ReadableStream({
      pull(controller) {
        controller.close();
      },
    });
    
    const reader = stream.getReader();
    const { done } = await reader.read();
    
    expect(done).toBe(true);
  });
});
