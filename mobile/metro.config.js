const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable symlink following — OneDrive mangles junctions in node_modules on Windows
config.resolver.unstable_enableSymlinks = false;

module.exports = config;
