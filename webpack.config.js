var webpack = require('webpack');

module.exports = {
  entry: {
    "knayi-myscript": __dirname + "/main.js",
    "knayi-myscript.min": __dirname + "/main.js",
  },
  devtool: "source-map",
  output: {
    path: __dirname + "/dist/",
    filename: "[name].js",
	  library:"knayi",
	  libraryTarget:"window"
  },
  module: {
  rules: [
    {
      test: /\.js$/,
      exclude: /(node_modules)/,
      loader: 'babel-loader',
      query: {
        presets: ['env']
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
