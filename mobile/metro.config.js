const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// node_modules is a Windows junction pointing to C:\nm_supportcard2 (outside OneDrive).
// Metro's bundler uses the real path for dependency resolution and the tree walk
// from C:\nm_supportcard2\<pkg>\... can't find sibling packages. Adding the junction
// target as an explicit module search root fixes this.
config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths || []),
  'C:\\nm_supportcard2',
];

module.exports = config;
