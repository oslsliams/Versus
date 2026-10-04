# Automatic updates for VERSUS

The code is prepared for Cloudflare Workers Builds. It is not connected to GitHub yet. This setup updates the existing `versus` Worker, `versusarena.org`, and `versus-db`.

## One-time setup

1. Put this project folder in a GitHub repository. Keep the repository private if you prefer. Use GitHub Desktop's **File > Add local repository** for this folder, commit the source, and **Publish repository**. Do not upload `node_modules`, `dist`, `.wrangler`, or credentials. The project's `.gitignore` excludes them.
2. In Cloudflare, open **Workers & Pages > versus > Settings > Builds** and connect that repository. Choose the existing Worker rather than creating another project.
3. Select your production branch, normally `main`. Use the repository root as the root directory when the project files are directly at its top level. If you uploaded the enclosing folder, choose the folder containing `package.json` instead.
4. Enable automatic builds for the production branch; leave preview builds disabled for this initial setup. Set **Build command** to `npm run build:cloudflare` and **Deploy command** to `npm run deploy:cloudflare`. Use Node 22 (or newer supported Node).
5. Choose a Cloudflare build API token scoped to this account with **Workers Scripts: Edit**, **D1: Edit**, and the zone permissions required for the configured custom domain (**Zone: Read**, **Workers Routes: Edit**, and **DNS: Edit** for versusarena.org). Store the token only in Cloudflare's protected build settings. Do not commit it or paste it in chat. Refer to Cloudflare's current Builds token configuration if the dashboard offers an automatically generated token; that token may need D1 permissions added.
6. Save and run the first build. Confirm it succeeds and then open https://versusarena.org.

## Future updates

Ask Codex for changes. Once the changes are tested, commit and push them to your production branch (or ask Codex to push them). Cloudflare builds that commit and deploys it automatically. Editing local files alone does not trigger a deployment. Changes pushed to the production branch become public.

The build command checks TypeScript and generates the Cloudflare bundle. The deploy command applies only pending versioned database migrations and uploads the built Worker and assets. If either step fails, it stops. Existing accounts and activity stay in D1. Database migration changes require normal review before pushing; rolling back the Worker does not roll back the database.

Reference: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
