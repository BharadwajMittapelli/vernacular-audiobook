## Revised plan for Tailwind CSS/PostCSS dependency restoration

### Objective
Restore correct Tailwind v4 and `@tailwindcss/postcss` dependencies using the existing lockfile, verify resolution, and validate the CSS pipeline and application.

### Steps
1. **Pre‑check (executed at repository root)**
   - Verify the current working directory is the repository root. `pwd`.
   - Confirm `package.json` contains the expected workspaces:
     ```json
     "workspaces": ["client", "server"]
     ```
   - Ensure `package-lock.json` exists and is readable.
   - Do **not** modify any source files or perform Git operations.

2. **Clean installation**
   - Run `npm ci` from the repository root. This will remove existing `node_modules` and install all dependencies exactly as recorded in `package-lock.json`.
   - Do not delete `node_modules` manually or run `npm install`.

3. **Verify dependency resolution**
   - After installation, verify the Tailwind and PostCSS plugins:
     ```sh
     npm ls tailwindcss @tailwindcss/postcss
     node -p "require.resolve('@tailwindcss/postcss')"
     ```
   - Confirm that the installed Tailwind version is `4.3.3` (or a compatible patch). Run `npx tailwindcss --version` if available.
   - Record the output for reporting.
   - If any of the above commands fail, stop and report the error.

4. **Validate CSS pipeline**
   - Use the existing `client/postcss.config.js` which references `@tailwindcss/postcss`.
   - Run a build or a single PostCSS compilation to ensure the plugin is loaded:
     ```sh
     npm run build:client
     ```
   - Inspect the `dist/assets/index.css` (or equivalent after build) to confirm that standard Tailwind utilities (`flex`, `items-center`, etc.) and custom theme utilities (`bg-primary`, `text-foreground`) are present.

5. **Validate application functionality**
   - Build the frontend to ensure no build errors: `npm run build:client`.
   - Run typecheck: `npm run typecheck` in the `client` workspace.
   - Start the Vite dev server: `cd client && npm run dev` and confirm it starts without PostCSS errors.
   - Open `http://localhost:5175/login` and `http://localhost:5175/register` to verify that the pages render styled correctly.

6. **Cross‑platform documentation**
   - **macOS**:
     ```sh
     cd <repo-root>
     npm ci
     cd client
     npm run dev
     ```
   - **Windows** (assuming PowerShell or CMD, same npm commands):
     ```powershell
     cd <repo-root>
     npm ci
     cd client
     npm run dev
     ```
   - No global npm installations are performed.

7. **Reporting**
   - After completion, produce a report containing:
     - Result of `npm ls` and `require.resolve`.
     - Tailwind version.
     - Confirmation of successful build, typecheck, and dev server startup.
     - Screenshot or description of CSS utilities in the generated CSS.
   - If any step fails, stop and report the exact command that failed and its output.

### Final Checklist
- Repository root verified.
- `package-lock.json` present and untouched.
- `npm ci` executed.
- `tailwindcss` `4.3.3` installed.
- `@tailwindcss/postcss` resolved.
- CSS pipeline runs without errors.
- App builds, typechecks, and serves with Tailwind styling.
- Cross‑platform install/startup steps documented.

---

The plan is ready for execution by an implementation‑capable agent.

