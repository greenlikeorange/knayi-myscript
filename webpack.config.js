var webpack = require("webpack");

module.exports = {
	entry: {
		"knayi-myscript": __dirname + "/src/main.js",
		"knayi-myscript.min": __dirname + "/src/main.js"
	},
	devtool: "source-map",
	output: {
		path: __dirname + "/dist/client",
		filename: "[name].js",
		library: "knayi",
		libraryTarget: "window"
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /(node_modules)/,
				loader: "babel-loader",
				query: {
					presets: ["env"]
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
};
