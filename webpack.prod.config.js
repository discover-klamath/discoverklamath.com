const path = require('path')
const webpack = require('webpack')
const ExtractTextPlugin = require("extract-text-webpack-plugin")

module.exports = {

    context: path.join(__dirname, 'code'),

    entry: [
        './src/index.js',
    ],

    output: {
        path: path.resolve(__dirname, 'code/public'),
        filename: 'bundle.min.js',
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
                test: /\.sass|.scss|.css$/,
                use: ExtractTextPlugin.extract({
                    fallback: "style-loader",
                    use: [
                        {loader: 'css-loader', options: {minimize: true}},
                        {loader: 'sass-loader', options: {minimize: true}},
                    ]
                })
            },
            {
                test: /\.(gif|png|jpe?g|svg|woff|woff2|eot|ttf)$/i,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[path][name].[ext]',
                        }
                    },
                    {
                        loader: 'image-webpack-loader',
                        options: {
                            mozjpeg: {
                                bypassOnDebug: true,
                                progressive: false,
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

    plugins: [
        new ExtractTextPlugin("styles.min.css"),
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery',
            'window.jQuery': 'jquery',
            Popper: ['popper.js', 'default']
        }),
        new webpack.optimize.UglifyJsPlugin({
            sourceMap: true,
            ecma: 8,
            compress: {
                warnings: false
            }
        })
    ]
}
