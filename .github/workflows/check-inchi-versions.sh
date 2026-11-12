#!/usr/bin/env bash
# For each entry in inchi_versions.json, compare the pinned commit with the
# latest commit behind the entry's URL. Supported URL formats:
#   https://github.com/<owner>/<repo>/releases/tag/<tag>
#   https://github.com/<owner>/<repo>/commits/<branch>
#   https://github.com/<owner>/<repo>/tree/<branch>
#   https://github.com/<owner>/<repo>/pull/<number>
# If the pinned commit is outdated, an issue is opened in GITHUB_REPOSITORY
# (or the existing open issue with the same title is updated).
#
# Usage: check-inchi-versions.sh <path/to/inchi_versions.json>
# Requires: gh (authenticated via GH_TOKEN), jq, GITHUB_REPOSITORY.
# Set DRY_RUN=1 to print issues instead of creating/updating them.

set -euo pipefail

versions_file="${1:?Usage: $0 <path/to/inchi_versions.json>}"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set}"
server_url="${GITHUB_SERVER_URL:-https://github.com}"
repo_url="${server_url}/${repo}"
url_pattern='^https://github\.com/([^/]+)/([^/]+)/(releases/tag|commits|tree|pull)/(.+[^/])/?$'

# Prints "<owner>/<repo> <sha>" for the latest commit behind the URL.
resolve_latest_commit() {
    local url="$1"
    if [[ ! "$url" =~ $url_pattern ]]; then
        echo "Unsupported URL format: ${url}" >&2
        return 1
    fi
    local upstream="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
    local kind="${BASH_REMATCH[3]}"
    local ref="${BASH_REMATCH[4]}"
    local sha
    if [[ "$kind" == "pull" ]]; then
        sha=$(gh api "repos/${upstream}/pulls/${ref}" --jq '.head.sha')
    else
        # Resolves tags (including annotated tags) and branches to a commit.
        sha=$(gh api "repos/${upstream}/commits/${ref}" --jq '.sha')
    fi
    echo "${upstream} ${sha}"
}

open_issues=$(gh api --paginate "repos/${repo}/issues?state=open&per_page=100" \
    --jq '.[] | select(.pull_request | not) | {number, title, body}' | jq -s '.')

failures=()
while IFS=$'\t' read -r version commit url; do
    if ! latest=$(resolve_latest_commit "$url"); then
        echo "::error::${version}: could not resolve ${url}"
        failures+=("$version")
        continue
    fi
    read -r upstream latest_sha <<<"$latest"

    if [[ "$latest_sha" == "$commit" ]]; then
        echo "${version}: up to date (${commit})."
        continue
    fi
    echo "::warning::${version}: new commit ${latest_sha} available (pinned ${commit})."

    title="New commit available for InChI version \"${version}\""
    body=$(cat <<EOF
A new commit is available for ${url}.

| | Commit |
|---|---|
| Pinned in \`pages/inchi_versions.json\` | ${upstream}@${commit} |
| Latest | ${upstream}@${latest_sha} |

Changes: https://github.com/${upstream}/compare/${commit}...${latest_sha}

To update, change the \`commit\` entry of \`"${version}"\` in [inchi_versions.json](${repo_url}/blob/HEAD/pages/inchi_versions.json) and follow the [update instructions](${repo_url}/blob/HEAD/README.md#update-an-inchi-version).

_Opened automatically by the "Check for new InChI commits" workflow._
EOF
)

    existing=$(jq -c --arg title "$title" 'map(select(.title == $title)) | first // empty' <<<"$open_issues")
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        echo "[dry run] Would $([[ -n "$existing" ]] && echo update || echo create) issue: ${title}"
        echo "$body"
    elif [[ -n "$existing" ]]; then
        number=$(jq -r '.number' <<<"$existing")
        if [[ "$(jq -r '.body // ""' <<<"$existing")" != "$body" ]]; then
            gh api --method PATCH "repos/${repo}/issues/${number}" -f body="$body" >/dev/null
            echo "${version}: updated issue #${number}."
        fi
    else
        number=$(gh api --method POST "repos/${repo}/issues" -f title="$title" -f body="$body" --jq '.number')
        echo "${version}: opened issue #${number}."
    fi
done < <(jq -r 'to_entries[] | [.key, .value.commit, .value.url] | @tsv' "$versions_file")

if ((${#failures[@]} > 0)); then
    echo "::error::Could not check: ${failures[*]}"
    exit 1
fi
