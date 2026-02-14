/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    'postcss-preset-env': {
      stage: 2,
      features: {
        'nesting-rules': true,
      },
    },
  },
};

module.exports = config;
