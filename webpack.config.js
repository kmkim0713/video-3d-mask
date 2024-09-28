const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    mode: 'development', // 개발 모드
    module: {
        rules: [
            {
                test: /\.css$/i, // .css 파일을 처리
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.js$/, // JS 파일을 처리
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
        new HtmlWebpackPlugin({
            template: 'src/index.html', // HTML 템플릿
        }),
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'), // 정적 파일 제공 디렉토리
        },
        compress: true,
        port: 9000, // 개발 서버 포트
    },
};
