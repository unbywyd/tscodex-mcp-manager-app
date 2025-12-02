/**
 * electronmon configuration
 * Watches for changes in main process and restarts Electron
 */
module.exports = {
  // Watch patterns - restart Electron when these change
  patterns: [
    'dist/main/**/*.js',
    'dist/main/**/*.cjs',
    'dist/host/**/*.js',
  ],
  // Ignore patterns
  ignore: [
    'dist/renderer/**',
    'node_modules/**',
    'src/**',
  ],
  // Environment variables
  env: {
    NODE_ENV: 'development',
  },
};
