module.exports = function (api) {
  api.cache(true);
  const plugins = [
    // Keep Reanimated plugin last
      ];

  if (process.env.NODE_ENV === 'production') {
    // Drop console.* calls in release builds to reduce JS bundle size
    plugins.unshift([
      'transform-remove-console',
      { exclude: ['error', 'warn'] },
    ]);
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
