// your-ai-copilot/babel.config.js
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: '12.22' // Target Node.js v12.22 for compatibility
        },
      },
    ],
  ],
};
