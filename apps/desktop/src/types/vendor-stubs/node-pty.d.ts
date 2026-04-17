declare module '@lydell/node-pty' {
  const nodePty: {
    spawn?: (...args: unknown[]) => unknown;
    default?: {
      spawn?: (...args: unknown[]) => unknown;
    };
  };

  export = nodePty;
}
