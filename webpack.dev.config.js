const webpack = require('webpack')
const path = require('path')
const BrowserSyncPlugin = require('browser-sync-webpack-plugin')

module.exports = {

    context: path.join(__dirname, 'code'),

    entry: [
        './src/index.js',
    ],

    output: {
        path: path.resolve(__dirname, 'code/public'),
        filename: 'bundle.js',
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
            // NOTE: use this for development so we can have hot module reloading
            {
                test: /\.sass|.scss|.css$/,
                use: [
                    'style-loader',
                    {loader: 'css-loader', options: {minimize: false}},
                    {loader: 'sass-loader', options: {minimize: false}},
                ]
            },
            {
                test: /\.(gif|png|jpe?g|svg|woff|woff2|eot|ttf)$/i,
                use: [
                    'file-loader',
                    {
                        loader: 'image-webpack-loader',
                        options: {
                            mozjpeg: {
                                bypassOnDebug: true,
                                progressive: true,
                                quality: 65
                            },
                            // optipng.enabled: false will disable optipng
                            optipng: {
                                bypassOnDebug: true,
                                enabled: false,
                            },
                            pngquant: {
                                bypassOnDebug: true,
                                quality: '65-90',
                                speed: 4
                            },
                            gifsicle: {
                                bypassOnDebug: true,
                                interlaced: false,
                            },
                            // the webp option will enable WEBP
                            webp: {
                                bypassOnDebug: true,
                                quality: 75
                            }
                        }
                    }
                ]
            }
        ]
    },

    watch: true,

    watchOptions: {
        aggregateTimeout: 300
    },

    devServer: {
        contentBase: path.join(__dirname, '/'),
        host: 'localhost',
        port: '3000',
        hot: true,
        proxy: {
            '*': 'http://localhost:8080'
        },
        headers: {'Access-Control-Allow-Origin': '*'}
    },

    plugins: [
        new webpack.NamedModulesPlugin(),
        new webpack.HotModuleReplacementPlugin(),
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery',
            'window.jQuery': 'jquery',
            Popper: ['popper.js', 'default']
        }),
        new BrowserSyncPlugin(
            {
                files: [
                    'code/craft/templates/**/*.twig',
                    'code/public/index.php',
                ],
                host: 'localhost',
                port: '5000',
                proxy: 'http://localhost:3000/',
                reloadOnRestart: true,
            },
            {
                reload: false
            }
        )
    ]
}