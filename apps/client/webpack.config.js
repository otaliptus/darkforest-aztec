const path = require('path');
const dotenv = require('dotenv');
const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config();

const isProd = process.env.NODE_ENV !== 'development';

const resolvePackage = require('resolve-package-path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

// This code is used to lookup where the `@darkforest_eth` packages exist in the tree
// whether they are in a monorepo or installed as packages
function findScopeDirectory() {
  // Just chose the most likely package to be here, it could really be anything
  const pkg = '@darkforest_eth/contracts';
  const contractsPackageJson = resolvePackage(pkg, __dirname);
  if (!contractsPackageJson) {
    throw new Error(`Unable to find the @darkforest_eth scope. Exiting...`);
  }
  const contractsDirectory = path.dirname(contractsPackageJson);
  const scopeDirectory = path.dirname(contractsDirectory);

  return scopeDirectory;
}

function findAztecNoirContractsArtifact() {
  const pkg = '@aztec/noir-contracts.js';
  const pkgJson = resolvePackage(pkg, __dirname);
  if (!pkgJson) {
    throw new Error(`Unable to find ${pkg} package. Exiting...`);
  }
  return path.join(path.dirname(pkgJson), 'artifacts', 'sponsored_fpc_contract-SponsoredFPC.json');
}

const ENV_DEFAULTS = {
  NODE_ENV: 'development',
  DEFAULT_RPC: 'https://rpc-df.xdaichain.com/',
  // This must be null to indicate to webpack that this environment variable is optional
  DF_WEBSERVER_URL: null,
  DF_SNAPSHOT_URL: null,
  DF_SNAPSHOT_AUTO_REFRESH: null,
  DF_SNAPSHOT_POLL_MS: null,
  DF_SNAPSHOT_MIN_INTERVAL_MS: null,
  AZTEC_NODE_URL: 'http://localhost:8080',
  DARKFOREST_ADDRESS: '',
  NFT_ADDRESS: '',
  SPONSORED_FPC_ADDRESS: '',
  ACCOUNT_INDEX: '0',
  ACCOUNT_SECRET: '',
  ACCOUNT_SALT: '',
  ACCOUNT_SIGNING_KEY: '',
  PROVER_ENABLED: 'false',
  PLANETHASH_KEY: '42',
  SPACETYPE_KEY: '43',
  PERLIN_LENGTH_SCALE: '1024',
  PERLIN_MIRROR_X: 'false',
  PERLIN_MIRROR_Y: 'false',
  INIT_X: '990',
  INIT_Y: '0',
  INIT_RADIUS: '1000',
  REVEAL_X: '123',
  REVEAL_Y: '456',
};

const CLIENT_ENV = Object.fromEntries(
  Object.entries(ENV_DEFAULTS).map(([key, fallback]) => {
    const value = process.env[key];
    return [key, value === undefined ? fallback : value];
  })
);

for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('VITE_') && value !== undefined) {
    CLIENT_ENV[key] = value;
    const baseKey = key.slice('VITE_'.length);
    if (process.env[baseKey] === undefined && Object.prototype.hasOwnProperty.call(ENV_DEFAULTS, baseKey)) {
      CLIENT_ENV[baseKey] = value;
    }
  }
}

module.exports = {
  mode: 'production',
  entry: ['./src/Frontend/EntryPoints/index.tsx'],
  output: {
    path: path.join(__dirname, '/dist'),
    filename: 'bundle-[contenthash].min.js',
    publicPath: '/',
    clean: true,
  },

  // Disable production sourcemaps to keep asset sizes under Pages limits.
  devtool: isProd ? false : 'source-map',
  devServer: {
    port: 8081,
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, 'public'),
      publicPath: '/public',
      watch: true,
    },
  },

  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: ['.ts', '.tsx', '...'],
    // Keep alias only for local shims; rely on node resolution for @darkforest_eth packages.
    alias: {
      pino: path.join(__dirname, 'src', 'Backend', 'Aztec', 'shims', 'pino-browser.ts'),
      'process/browser': require.resolve('process/browser.js'),
    },
    fallback: {
      buffer: require.resolve('buffer/'),
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      process: require.resolve('process/browser'),
      path: require.resolve('path-browserify'),
      fs: false,
      net: false,
      tls: false,
    },
  },

  module: {
    rules: [
      // Still depends on raw-loader here, with the javascript/auto content type,
      // because otherwise the module can't be imported in PluginManager
      {
        test: /\.[jt]sx?$/,
        include: [path.join(__dirname, './embedded_plugins/')],
        type: 'javascript/auto',
        use: ['raw-loader', 'babel-loader'],
      },
      {
        test: /\.ts(x?)$/,
        include: [path.join(__dirname, './src/')],
        use: ['babel-loader'],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(woff(2)?|ttf|eot|svg)$/,
        include: [path.join(__dirname, './src/')],
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]',
        },
      },
      {
        test: /\.json$/,
        include: [
          path.join(__dirname, '../../node_modules/@aztec'),
          path.join(__dirname, '../../packages/contracts'),
        ],
        type: 'json',
      },
      // Any wasm or zkey files from other packages should be loaded as a plain file
      {
        test: /\.(wasm|zkey)$/,
        type: 'asset/resource',
      },
      // Default JSON handling for non-Aztec assets (served as files)
      {
        test: /\.json$/,
        exclude: [
          path.join(__dirname, '../../node_modules/@aztec'),
          path.join(__dirname, '../../packages/contracts'),
        ],
        type: 'asset/resource',
      },
      // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'
      {
        enforce: 'pre',
        test: /\.js$/,
        loader: 'source-map-loader',
        options: {
          filterSourceMappingUrl(url, resourcePath) {
            // The sourcemaps in react-sortable are screwed up
            if (resourcePath.includes('react-sortablejs')) {
              return false;
            }

            return true;
          },
        },
      },
    ],
  },
  plugins: [
    new NodePolyfillPlugin(),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: ['process/browser'],
    }),
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(CLIENT_ENV),
    }),
    new HtmlWebpackPlugin({
      template: './index.html',
    }),
    new CopyPlugin({
      patterns: [
        { from: 'public', to: 'public' },
        {
          from: findAztecNoirContractsArtifact(),
          to: 'public/aztec/sponsored_fpc_contract-SponsoredFPC.json',
        },
      ],
    }),
  ],
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      maxSize: 20 * 1024 * 1024,
    },
  },
};
