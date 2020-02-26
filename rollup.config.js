import typescript from 'rollup-plugin-typescript2';
import nodeResolve from 'rollup-plugin-node-resolve';

export default {
    input: './src/main.ts',
    plugins: [nodeResolve(), typescript({
        tsconfigOverride: {
            compilerOptions: { module: 'esnext' }
        }
    })],
    output: [{
        file: './Emmet.novaextension/Scripts/main.js',
        format: 'cjs',
        sourcemap: true
    }]
};
