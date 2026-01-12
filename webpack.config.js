const nodeExternals = require('webpack-node-externals');

module.exports = function (options, webpack) {
  return {
    ...options,
    externals: [
      nodeExternals({
        // Bundle all packages except @usex/rule-engine which must remain external
        allowlist: [/^(?!@usex\/rule-engine).*/],
      }),
      // Explicitly mark @usex/rule-engine as external so it's not bundled
      '@usex/rule-engine',
    ],
  };
};
