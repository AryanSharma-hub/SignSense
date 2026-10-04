// Thin re-export so existing import paths (seed.js, client test fixtures) never change.
// The real data lives in ./seedData/ — see index.js for how it's assembled.
export * from './seedData/index.js';
