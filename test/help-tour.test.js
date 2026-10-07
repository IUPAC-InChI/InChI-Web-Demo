const {
  HELP_TOUR_STEPS,
  pickTourSide,
  tourCardPosition,
} = require("../pages/help-tour.js");

const view = { width: 1200, height: 800 };
const card = { width: 352, height: 200 };
const rect = (top, left, width, height) => ({
  top,
  left,
  width,
  height,
  bottom: top + height,
  right: left + width,
});

test("every step has a selector, a title and a body", () => {
  for (const step of HELP_TOUR_STEPS) {
    expect(step.selector).toBeTruthy();
    expect(step.title).toBeTruthy();
    expect(step.body).toBeTruthy();
  }
});

test("the card goes below a part when there is room", () => {
  expect(pickTourSide(rect(100, 100, 300, 100), card, view)).toBe("below");
});

test("the card goes above a part near the bottom of the viewport", () => {
  expect(pickTourSide(rect(600, 100, 300, 100), card, view)).toBe("above");
});

test("the card goes beside a part that fills the viewport's height", () => {
  expect(pickTourSide(rect(50, 50, 500, 700), card, view)).toBe("right");
});

test("the card stays on screen when nothing around a part fits it", () => {
  const huge = rect(-100, 0, 1200, 1000);
  const side = pickTourSide(huge, card, view);
  const { top, left } = tourCardPosition(huge, side, card, view);
  expect(top).toBeGreaterThanOrEqual(12);
  expect(top + card.height).toBeLessThanOrEqual(view.height - 12);
  expect(left).toBeGreaterThanOrEqual(12);
  expect(left + card.width).toBeLessThanOrEqual(view.width - 12);
});

test("the card is clamped inside a phone-width viewport", () => {
  const phone = { width: 360, height: 700 };
  const { left } = tourCardPosition(
    rect(100, 300, 50, 40),
    "below",
    card,
    phone
  );
  expect(left).toBe(12);
});
