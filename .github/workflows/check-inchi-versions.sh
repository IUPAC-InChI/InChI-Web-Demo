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

# Prints "<owner>/<repo> <source state> <sha>" for the latest commit behind the URL.
resolve_latest_commit() {
    local url="$1"
    if [[ ! "$url" =~ $url_pattern ]]; then
        echo "Unsupported URL format: ${url}" >&2
        return 1
    fi
    local upstream="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
    local kind="${BASH_REMATCH[3]}"
    local ref="${BASH_REMATCH[4]}"
    local source_state=open
    local sha
    if [[ "$kind" == "pull" ]]; then
        local pull
        pull=$(gh api "repos/${upstream}/pulls/${ref}" --jq '[.state, .head.sha] | @tsv') || return 1
        read -r source_state sha <<<"$pull"
    else
        # Resolves tags (including annotated tags) and branches to a commit.
        sha=$(gh api "repos/${upstream}/commits/${ref}" --jq '.sha') || return 1
    fi
    if [[ "$source_state" != "open" && "$source_state" != "closed" ]]; then
        echo "Invalid pull request state returned for ${url}: ${source_state}" >&2
        return 1
    fi
    if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
        echo "Invalid commit SHA returned for ${url}: ${sha}" >&2
        return 1
    fi
    echo "${upstream} ${source_state} ${sha}"
}

entries=$(jq -r 'to_entries[] | [.key, .value.commit, .value.url] | @tsv' "$versions_file")
if [[ -z "$entries" ]]; then
    echo "::error::No versions found in ${versions_file}"
    exit 1
fi
issues=$(gh api --paginate "repos/${repo}/issues?state=all&per_page=100" \
    --jq '.[] | select(.pull_request | not) | {number, title, body, state}' | jq -s '.')

failures=()
while IFS=$'\t' read -r version commit url; do
    if ! latest=$(resolve_latest_commit "$url"); then
        echo "::error::${version}: could not resolve ${url}"
        failures+=("$version")
        continue
    fi
    read -r upstream source_state latest_sha <<<"$latest"

    if [[ "$latest_sha" == "$commit" && "$source_state" == "open" ]]; then
        echo "${version}: up to date (${commit})."
        continue
    fi
    if [[ "$source_state" == "closed" ]]; then
        echo "::warning::${version}: source pull request is closed; review the pinned commit."
    else
        echo "::warning::${version}: new commit ${latest_sha} available (pinned ${commit})."
    fi

    if [[ "$source_state" == "closed" ]]; then
        title="Review closed source for InChI version \"${version}\""
        intro="The source pull request at ${url} is closed. Review this pinned version and either update it to the appropriate branch or release, or remove it."
    else
        title="New commit available for InChI version \"${version}\""
        intro="A new commit is available for ${url}."
    fi
    body=$(cat <<EOF
${intro}

| | Commit |
|---|---|
| Pinned in \`pages/inchi_versions.json\` | ${upstream}@${commit} |
| Latest | ${upstream}@${latest_sha} |

$(if [[ "$latest_sha" != "$commit" ]]; then echo "Changes: https://github.com/${upstream}/compare/${commit}...${latest_sha}"; fi)

To update, change the \`commit\` entry of \`"${version}"\` in [inchi_versions.json](${repo_url}/blob/HEAD/pages/inchi_versions.json) and follow the [update instructions](${repo_url}/blob/HEAD/README.md#update-an-inchi-version).

_Opened automatically by the "Check for new InChI commits" workflow._
EOF
)

    existing_open=$(jq -c --arg title "$title" \
        'map(select(.title == $title and .state == "open")) | first // empty' <<<"$issues")
    existing_closed=$(jq -c --arg title "$title" --arg latest_sha "$latest_sha" \
        'map(select(.title == $title and .state == "closed" and ((.body // "") | contains($latest_sha)))) | first // empty' \
        <<<"$issues")
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        if [[ -n "$existing_open" ]]; then
            echo "[dry run] Would update issue: ${title}"
        elif [[ -n "$existing_closed" ]]; then
            number=$(jq -r '.number' <<<"$existing_closed")
            echo "[dry run] Would skip closed issue #${number} for ${latest_sha}."
        else
            echo "[dry run] Would create issue: ${title}"
        fi
        [[ -n "$existing_closed" && -z "$existing_open" ]] || echo "$body"
    elif [[ -n "$existing_open" ]]; then
        number=$(jq -r '.number' <<<"$existing_open")
        if [[ "$(jq -r '.body // ""' <<<"$existing_open")" != "$body" ]]; then
            gh api --method PATCH "repos/${repo}/issues/${number}" -f body="$body" >/dev/null
            echo "${version}: updated issue #${number}."
        fi
    elif [[ -n "$existing_closed" ]]; then
        number=$(jq -r '.number' <<<"$existing_closed")
        echo "${version}: closed issue #${number} already tracks ${latest_sha}; skipping."
    else
        number=$(gh api --method POST "repos/${repo}/issues" -f title="$title" -f body="$body" --jq '.number')
        echo "${version}: opened issue #${number}."
    fi
done <<<"$entries"

if ((${#failures[@]} > 0)); then
    echo "::error::Could not check: ${failures[*]}"
    exit 1
fi
