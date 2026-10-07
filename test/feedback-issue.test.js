const {
  FEEDBACK_URL_BUDGET,
  buildFeedbackIssue,
  feedbackContextMarkdown,
} = require("../pages/feedback-issue.js");

const context = {
  identifierLabel: "InChI",
  identifier: "InChI=1S/CH4/h1H4",
  version: "1.07.5",
  options: "-SNon",
  input: "drawn in the editor",
  page: "https://example.org/",
  userAgent: "Test/1.0",
};

const params = (url) => new URL(url).searchParams;
const bytes = (text) => new TextEncoder().encode(text).length;

test("the link opens a new issue on the web app's repository", () => {
  const { url } = buildFeedbackIssue({ category: "bug", message: "x", context });
  expect(url).toMatch(
    /^https:\/\/github\.com\/IUPAC-InChI\/InChI-Web-Demo\/issues\/new\?/
  );
});

test("the title carries the kind and an excerpt of the message", () => {
  const { url } = buildFeedbackIssue({
    category: "suggestion",
    message: "Show the\nlayers in colour",
    context,
  });
  expect(params(url).get("title")).toBe("[Suggestion] Show the layers in colour");
});

test("a long message is cut in the title but never in the body", () => {
  const message = "word ".repeat(40).trim();
  const { url } = buildFeedbackIssue({ category: "bug", message, context });
  expect(params(url).get("title").endsWith("…")).toBe(true);
  expect(params(url).get("body")).toContain(message);
});

test("an @ in the message cannot ping anyone", () => {
  const { url } = buildFeedbackIssue({
    category: "question",
    message: "ask @someone",
    context,
  });
  expect(params(url).get("title")).not.toContain("@");
  expect(params(url).get("body")).toContain("ask (at)someone");
});

test("the body carries the context the preview shows", () => {
  const { url, fitted } = buildFeedbackIssue({
    category: "bug",
    message: "m",
    context,
  });
  expect(fitted).toBe(true);
  expect(params(url).get("body")).toContain(feedbackContextMarkdown(context));
});

test("an unticked identifier leaves no identifier block", () => {
  const markdown = feedbackContextMarkdown({ ...context, identifier: "" });
  expect(markdown).not.toContain("InChI=");
  expect(markdown).toContain("InChI version: 1.07.5");
});

test("context too long for the link is left for the clipboard", () => {
  const huge = { ...context, identifier: "InChI=1S/" + "C".repeat(9000) };
  const issue = buildFeedbackIssue({ category: "bug", message: "m", context: huge });
  expect(issue.fitted).toBe(false);
  expect(bytes(issue.url)).toBeLessThanOrEqual(FEEDBACK_URL_BUDGET);
  expect(params(issue.url).get("body")).toContain("copied to your clipboard");
  expect(issue.clipboard).toBe(feedbackContextMarkdown(huge));
});
