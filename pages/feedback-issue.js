/*
 * The prefilled GitHub issue behind the feedback dialog's "this web app"
 * route. Pure: the dialog gathers the context, this turns it into a
 * github.com/…/issues/new link.
 *
 * The issue is public and opened by the visitor in their own GitHub account,
 * so nothing is sent from the page itself. GitHub drops what does not fit in
 * a URL of about 8 KB, so when the context does not fit it is left out of the
 * link and handed back for the clipboard instead.
 */

const FEEDBACK_ISSUES_URL =
  "https://github.com/IUPAC-InChI/InChI-Web-Demo/issues/new";

/* Below GitHub's limit, with room for the browser's own encoding quirks. */
const FEEDBACK_URL_BUDGET = 7680;

const FEEDBACK_TITLE_EXCERPT = 60;

const FEEDBACK_CATEGORIES = {
  bug: "Bug",
  suggestion: "Suggestion",
  question: "Question",
};

/*
 * "@name" in an issue body pings that GitHub user. The message is the
 * visitor's free text, so it must not be able to.
 */
function neutralizeMentions(text) {
  return text.replace(/@/g, "(at)");
}

function feedbackIssueTitle(category, message) {
  const prefix = `[${FEEDBACK_CATEGORIES[category] ?? "Feedback"}]`;
  const line = neutralizeMentions(message.replace(/\s+/g, " ").trim());
  if (!line) {
    return `${prefix} Web app feedback`;
  }
  const excerpt =
    line.length > FEEDBACK_TITLE_EXCERPT
      ? `${line.slice(0, FEEDBACK_TITLE_EXCERPT).trimEnd()}…`
      : line;
  return `${prefix} ${excerpt}`;
}

/* The context as Markdown: one labelled line or fenced block per value. */
function feedbackContextMarkdown(context) {
  const fenced = (value) => "```\n" + value + "\n```";
  const lines = ["### Context", ""];
  if (context.identifier) {
    lines.push(`${context.identifierLabel ?? "InChI"}:`, fenced(context.identifier));
  }
  lines.push(
    `InChI version: ${context.version || "(unknown)"}`,
    `Options: ${context.options || "(defaults)"}`,
    `Input: ${context.input || "(unknown)"}`,
    `Page: ${context.page || "(unknown)"}`,
    "User agent:",
    fenced(context.userAgent || "(unknown)")
  );
  return lines.join("\n");
}

function feedbackIssueBody(category, message, contextMarkdown) {
  return [
    `**${FEEDBACK_CATEGORIES[category] ?? "Feedback"}**`,
    "",
    neutralizeMentions(message.trim()),
    "",
    "---",
    "",
    contextMarkdown,
  ].join("\n");
}

function feedbackIssueLink(title, body) {
  return `${FEEDBACK_ISSUES_URL}?${new URLSearchParams({ title, body })}`;
}

/*
 * The issue link, and whether the context fitted in it. When it did not, the
 * context comes back as `clipboard` for the visitor to paste. The message is
 * never cut; only the context gives way.
 */
function buildFeedbackIssue({ category, message, context }) {
  const title = feedbackIssueTitle(category, message);
  const contextMarkdown = feedbackContextMarkdown(context);
  const url = feedbackIssueLink(
    title,
    feedbackIssueBody(category, message, contextMarkdown)
  );
  if (new TextEncoder().encode(url).length <= FEEDBACK_URL_BUDGET) {
    return { url, fitted: true, clipboard: "" };
  }
  const placeholder =
    "### Context\n\n" +
    "(Too long for the link. It was copied to your clipboard: paste it here.)";
  return {
    url: feedbackIssueLink(
      title,
      feedbackIssueBody(category, message, placeholder)
    ),
    fitted: false,
    clipboard: contextMarkdown,
  };
}

if (typeof module === "object" && module.exports) {
  module.exports = {
    FEEDBACK_CATEGORIES,
    FEEDBACK_URL_BUDGET,
    buildFeedbackIssue,
    feedbackContextMarkdown,
  };
}
