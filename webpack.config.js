var webpack = require('webpack');

module.exports = {
  entry: {
    "knayi-myscript": __dirname + "/client.js",
    "knayi-myscript.min": __dirname + "/client.js",
  },
  devtool: "source-map",
  output: {
    path: __dirname + "/dist/",
    filename: "[name].js"
  },
  module: {
  rules: [
    {
      test: /\.js$/,
      exclude: /(node_modules)/,
      loader: 'babel-loader',
      query: {
        presets: ['latest', 'stage-0']
      }
    }
  ]
},
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      include: /\.min\.js$/,
      minimize: true
    })
  ]
}
