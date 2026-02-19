const path = require('node:path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: 'development',
  devServer: {
    static: './dist',
    port: 9000,
    open: true,
    proxy: [
      { context: ['/api/compliance'], target: 'http://localhost:8080', pathRewrite: { '^/api/compliance': '' } },
      { context: ['/api/alerts'], target: 'http://localhost:8081', pathRewrite: { '^/api/alerts': '' } },
      { context: ['/api/simulator'], target: 'http://localhost:8082', pathRewrite: { '^/api/simulator': '' } },
    ],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
};
