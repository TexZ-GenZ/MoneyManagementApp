module.exports = function (api) {
  api.cache(true);
  const plugins = [];

  if (process.env.NODE_ENV === 'production') {
    // Drop console.* calls in release builds to reduce JS bundle size
    plugins.push([
      'transform-remove-console',
      { exclude: ['error', 'warn'] },
    ]);
  }

  // Keep Reanimated plugin last
  plugins.push('react-native-reanimated/plugin');

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
