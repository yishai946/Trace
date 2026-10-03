#!/usr/bin/env bash
# One-time setup of the "Trace Board" GitHub Project (v2): fields, Kanban columns,
# repo link, automation variables/secret, and loading all existing issues onto the board.
#
# Run from your own machine (needs the GitHub CLI, jq, and a login with project scope):
#   gh auth refresh -s project,repo,workflow
#   ./scripts/setup-project.sh
#
# Optional env:
#   TRACE_PROJECT_PAT   PAT (scopes: project, repo) stored as the PROJECT_TOKEN secret used by the
#                       automation workflow. If unset, the script prints how to add it.
set -euo pipefail

command -v gh >/dev/null || { echo "gh CLI required"; exit 1; }
command -v jq >/dev/null || { echo "jq required"; exit 1; }

REPO="${TRACE_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
OWNER="${REPO%%/*}"
TITLE="Trace Board"

echo "==> Repo: $REPO"

# ---- 1. project -------------------------------------------------------------
NUM=$(gh project list --owner "$OWNER" --format json --jq ".projects[] | select(.title==\"$TITLE\") | .number" | head -1 || true)
if [ -z "${NUM:-}" ]; then
  NUM=$(gh project create --owner "$OWNER" --title "$TITLE" --format json --jq .number)
  echo "==> Created project #$NUM"
else
  echo "==> Reusing project #$NUM"
fi
PID=$(gh project view "$NUM" --owner "$OWNER" --format json --jq .id)

gh project edit "$NUM" --owner "$OWNER" \
  --description "Trace: search & rescue coordination. V0 ops -> V1 LPB probability -> V2 simulation." \
  --readme "Board columns: Backlog -> Ready -> In Progress -> In Review -> QA -> Blocked -> Done. Issues and PRs move automatically (see .github/workflows/project-automation.yml)." >/dev/null
gh project link "$NUM" --owner "$OWNER" --repo "$REPO" >/dev/null 2>&1 || true

# ---- 2. custom fields -------------------------------------------------------
fields_json() { gh project field-list "$NUM" --owner "$OWNER" --format json; }
have_field() { fields_json | jq -e --arg n "$1" '.fields[] | select(.name==$n)' >/dev/null; }
mk_select() { have_field "$1" || gh project field-create "$NUM" --owner "$OWNER" --name "$1" --data-type SINGLE_SELECT --single-select-options "$2" >/dev/null; }

mk_select "Phase"    "V0 MVP,V1 LPB,V2 Simulation,Future"
mk_select "Priority" "P0 Critical,P1 High,P2 Medium,P3 Low"
mk_select "Size"     "XS,S,M,L,XL"
have_field "Target date" || gh project field-create "$NUM" --owner "$OWNER" --name "Target date" --data-type DATE >/dev/null

# ---- 3. Status columns (replaces default Todo / In Progress / Done) ---------
STATUS_ID=$(fields_json | jq -r '.fields[] | select(.name=="Status") | .id')
jq -n --arg f "$STATUS_ID" '{
  query: "mutation($f:ID!,$o:[ProjectV2SingleSelectFieldOptionInput!]){ updateProjectV2Field(input:{fieldId:$f,singleSelectOptions:$o}){ projectV2Field{ ... on ProjectV2SingleSelectField { id } } } }",
  variables: { f: $f, o: [
    {name:"Backlog",     color:"GRAY",   description:"Triaged, not yet ready"},
    {name:"Ready",       color:"BLUE",   description:"Scoped and ready to pick up"},
    {name:"In Progress", color:"YELLOW", description:"Someone is working on it"},
    {name:"In Review",   color:"PURPLE", description:"PR open, awaiting review"},
    {name:"QA",          color:"ORANGE", description:"Merged, awaiting QA sign-off (remove needs-qa)"},
    {name:"Blocked",     color:"RED",    description:"Waiting on a decision or dependency"},
    {name:"Done",        color:"GREEN",  description:"Finished and verified"} ] } }' \
  | gh api graphql --input - >/dev/null
echo "==> Fields and Status columns configured"

# ---- 4. automation wiring ---------------------------------------------------
gh variable set PROJECT_OWNER  --repo "$REPO" --body "$OWNER"
gh variable set PROJECT_NUMBER --repo "$REPO" --body "$NUM"
if [ -n "${TRACE_PROJECT_PAT:-}" ]; then
  gh secret set PROJECT_TOKEN --repo "$REPO" --body "$TRACE_PROJECT_PAT"
  echo "==> PROJECT_TOKEN secret set"
else
  echo "!! Add the PROJECT_TOKEN secret (PAT with project + repo scopes):"
  echo "   gh secret set PROJECT_TOKEN --repo $REPO"
fi

# ---- 5. load existing issues onto the board ---------------------------------
FJ=$(fields_json)
opt() { jq -r --arg f "$1" --arg n "$2" '.fields[] | select(.name==$f) | .options[]? | select(.name==$n or (.name|startswith($n+" "))) | .id' <<<"$FJ" | head -1; }
fid() { jq -r --arg f "$1" '.fields[] | select(.name==$f) | .id' <<<"$FJ"; }
set_sel() { # item field option-name
  local oid; oid=$(opt "$2" "$3"); [ -n "$oid" ] || return 0
  gh project item-edit --id "$1" --project-id "$PID" --field-id "$(fid "$2")" --single-select-option-id "$oid" >/dev/null
}

echo "==> Adding issues to the board"
gh issue list --repo "$REPO" --state open --limit 500 --json number,url,labels,body \
 | jq -c '.[]' | while read -r row; do
  url=$(jq -r .url <<<"$row")
  item=$(gh project item-add "$NUM" --owner "$OWNER" --url "$url" --format json --jq .id)
  phase=$(jq -r '[.labels[].name | select(startswith("phase: ")) | sub("phase: ";"")][0] // empty' <<<"$row")
  pri=$(jq -r '.body | capture("\\*\\*Priority:\\*\\* (?<p>P[0-3])") | .p' <<<"$row" 2>/dev/null || true)
  size=$(jq -r '.body | capture("\\*\\*Size:\\*\\* (?<s>XS|S|M|L|XL)") | .s' <<<"$row" 2>/dev/null || true)
  blocked=$(jq -r '[.labels[].name] | index("blocked") != null' <<<"$row")
  set_sel "$item" Status "$([ "$blocked" = true ] && echo Blocked || echo Backlog)"
  [ -n "$phase" ] && set_sel "$item" Phase "$phase"
  [ -n "$pri" ]   && set_sel "$item" Priority "$pri"
  [ -n "$size" ]  && set_sel "$item" Size "$size"
  echo "   + $url"
done

URL=$(gh project view "$NUM" --owner "$OWNER" --format json --jq .url)
cat <<EOF

Done. Board: $URL

One manual step (the API cannot create views): open the board, and
  1) rename the default view to "Board" and switch Layout -> Board (group by Status)
  2) add a "Roadmap" view (Layout -> Roadmap, group by Phase) and a "My work" view (filter: assignee:@me)
Built-in project workflows (Settings -> Workflows) are optional; the Actions workflow already
handles add-to-project, status moves, and phase sync.
EOF
