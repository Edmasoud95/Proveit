/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['../../.eslintrc.cjs', 'plugin:react-hooks/recommended'],
  env: {
    browser: true,
    es2022: true,
  },
};
