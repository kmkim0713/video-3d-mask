const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/index.ts',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    mode: 'development',
    resolve: {
        extensions: ['.ts', '.js'], // TypeScript 및 JavaScript 파일 확장자
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.ts$/, // TypeScript 파일 처리
                exclude: /node_modules/,
                use: {
                    loader: 'ts-loader', // ts-loader 사용
                },
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
        ],
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, 'src/public'), // 복사할 디렉토리
                    to: path.resolve(__dirname, 'dist/public'), // 복사할 목적지
                    noErrorOnMissing: true, // 에러 발생 방지
                },
            ],
        }),
        new HtmlWebpackPlugin({
            template: 'src/index.html',
        }),
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        compress: true,
        port: 9000,
    },
};
