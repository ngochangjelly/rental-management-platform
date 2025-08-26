const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    dashboard: './src/js/dashboard.js',
    login: './src/js/login.js',
    'investor-management': './src/js/investor-management.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/[name].[contenthash].js',
    clean: true,
    publicPath: '/'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    // Dashboard page
    new HtmlWebpackPlugin({
      template: './public/dashboard.html',
      filename: 'dashboard.html',
      chunks: ['dashboard'],
      inject: 'body'
    }),
    // Login page
    new HtmlWebpackPlugin({
      template: './public/login.html',
      filename: 'login.html',
      chunks: ['login'],
      inject: 'body'
    }),
    // Index page (redirect to login)
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
      chunks: [],
      inject: false
    }),
    // Investor Management page
    new HtmlWebpackPlugin({
      template: './public/investor-management.html',
      filename: 'investor-management.html',
      chunks: ['investor-management'],
      inject: 'body'
    }),
    // Copy static assets
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'public',
          to: '',
          globOptions: {
            ignore: ['**/*.html', '**/js/**']
          }
        }
      ]
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    port: 3000,
    open: true,
    historyApiFallback: {
      rewrites: [
        { from: /^\/$/, to: '/index.html' },
        { from: /^\/dashboard/, to: '/dashboard.html' },
        { from: /^\/login/, to: '/login.html' },
        { from: /^\/investor-management/, to: '/investor-management.html' }
      ]
    },
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        logLevel: 'debug'
      }
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/js/components')
    }
  }
};