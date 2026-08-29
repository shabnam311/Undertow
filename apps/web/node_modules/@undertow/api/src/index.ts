import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => {
  return c.text('Undertow API is running!');
});

// We will attach tRPC routes here

export default {
  port: 3001,
  fetch: app.fetch,
};
