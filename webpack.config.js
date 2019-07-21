const webpack = require('webpack');

const esConfig = {
  target: 'node',
  entry: {
    "knayi-myscript": __dirname + "/main.js"
  },
  output: {
    path: __dirname + "/dist/",
    filename: "[name].es.js",
    library: "knayi",
    libraryTarget: "commonjs2"
  },
  module: {
    rules: [{
      test: /\.js$/, 
      exclude: /(node_modules)/, 
      use: {
        loader: 'babel-loader', 
        options: {
          presets: ['@babel/preset-env']
        }
      },
    }]
  }
}

const legacyConfig = {
  target: 'web',
  entry: {
    "knayi-myscript": __dirname + "/main.js",
    "knayi-myscript.min": __dirname + "/main.js",
  },
  devtool: "source-map",
  output: {
    path: __dirname + "/dist/",
    filename: "[name].js",
    library: "knayi",
    libraryTarget: "window"
  },
  module: {
    rules: [{
      test: /\.js$/, 
      exclude: /(node_modules)/, 
      use: {
        loader: 'babel-loader', 
        options: {
          presets: ['@babel/preset-env']
        }
      },
    }]
  }
}

module.exports = [
  esConfig, legacyConfig
]
