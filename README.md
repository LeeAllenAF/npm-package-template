# npm-package-template

A reusable GitHub template for public, ESM-first TypeScript npm libraries.

## Included

- Strict TypeScript, declaration files and source maps
- ESLint with type-aware rules, Prettier, Vitest and coverage
- Husky pre-commit lint-staged and pre-push validation
- GitHub Actions CI, npm trusted publishing via OIDC, Dependabot
- MIT license, contribution guide, security policy and issue templates

## Create a package

1. Choose **Use this template** on GitHub to create a new repository.
2. Clone it and run `npm run init`. This detects your GitHub origin and asks for npm name, description and author.
3. Or initialize non-interactively:

   ```sh
   npm run init -- --repo your-account/my-library --name @your-scope/my-library --description "A library" --author "Your Name" --yes
   ```

   Add `--dry-run` to preview.
4. Run `npm install`, `npm run check`, and `npm pack --dry-run`; commit the generated `package-lock.json`.
5. Set up npm trusted publishing (repository, workflow `publish.yml`, GitHub environment `npm`) and repository branch protections.
6. Push a reviewed `vX.Y.Z` tag matching the package version to publish. Your first package version may need an interactive publish.

The initializer refuses to modify this original template, rejects preexisting lockfiles, and removes its own initialization script after successful setup.

## Development

```sh
npm install
npm run check
npm run coverage
npm pack --dry-run
```

## License

MIT.
