<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project architecture

- Keep public product areas as independent TanStack routes inside the shared MediCita AppShell so navigation, metadata, and mobile access stay consistent.
- Import the configured browser database client through `@/lib/supabase`; keep privileged access inside authenticated server functions so database policies remain authoritative.
