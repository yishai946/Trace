#!/usr/bin/env bash
# Permissions + repo settings. Run once as the repo owner:
#   TRACE_DANIEL=<github-handle> TRACE_SEGEV=<github-handle> ./scripts/setup-repo-settings.sh
set -euo pipefail
REPO="${TRACE_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

# Team: owner = admin; teammates = write (personal repos have no finer roles)
for u in "${TRACE_DANIEL:-}" "${TRACE_SEGEV:-}"; do
  [ -n "$u" ] && gh api -X PUT "repos/$REPO/collaborators/$u" -f permission=push >/dev/null && echo "invited $u (write)"
done

# Merge policy + hygiene
gh api -X PATCH "repos/$REPO" -F delete_branch_on_merge=true -F allow_squash_merge=true \
  -F allow_merge_commit=false -F allow_rebase_merge=false -F has_wiki=false -F has_projects=true \
  -f squash_merge_commit_title=PR_TITLE >/dev/null

# main: PR + 1 approval, no force-push/delete, conversations resolved (admin may bypass)
gh api -X PUT "repos/$REPO/branches/main/protection" --input - >/dev/null <<'JSON'
{"required_status_checks":null,"enforce_admins":false,
 "required_pull_request_reviews":{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":false},
 "restrictions":null,"allow_force_pushes":false,"allow_deletions":false,"required_conversation_resolution":true}
JSON
echo "Repo settings and branch protection applied."
