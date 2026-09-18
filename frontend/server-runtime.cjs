const { AsyncLocalStorage } = require("node:async_hooks");

globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
