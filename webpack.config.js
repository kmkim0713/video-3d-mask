const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/index.js', // 진입점 파일 설정
    output: {
        filename: 'bundle.js', // 번들링된 파일 이름
        path: path.resolve(__dirname, 'dist'), // 번들링된 파일이 저장될 경로
        clean: true, // 빌드 전에 dist 폴더를 정리
    },
    module: {
        rules: [
            {
                test: /\.js$/, // .js 파일을 대상으로
                exclude: /node_modules/, // node_modules 디렉토리는 제외
                use: {
                    loader: 'babel-loader', // babel-loader 사용
                    options: {
                        presets: ['@babel/preset-env'], // Babel preset 설정
                    },
                },
            },
            {
                test: /\.css$/, // .css 파일을 대상으로
                use: ['style-loader', 'css-loader'], // style-loader와 css-loader 사용
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html', // 템플릿 파일 설정
            filename: 'index.html', // 생성될 파일 이름
        }),
    ],
    devtool: 'source-map', // 소스맵 설정 (디버깅용)
    devServer: {
        static: path.join(__dirname, 'dist'), // dev server가 제공할 정적 파일 경로
        compress: true, // gzip 압축 설정
        port: 9000, // dev server 포트 설정
    },
};
