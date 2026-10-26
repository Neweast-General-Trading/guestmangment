import assert from "node:assert/strict";
import { hospitalityData, hasHospitality, mealSummary } from "./hospitality";

function check() {
  const saved = hospitalityData({
    fromAbroad: true,
    stayNights: 3,
    hotelRequired: true,
    mealLunch: true,
    mealDinner: true,
    originCountry: "Italy",
  });
  assert.equal(saved.fromAbroad, true);
  assert.equal(saved.stayNights, 3);
  assert.equal(saved.hotelRequired, true);
  assert.equal(hasHospitality(saved), true);
  assert.equal(mealSummary(saved), "Lunch · Dinner");
  assert.equal(hasHospitality(hospitalityData({})), false);
  const fromCatalogue = hospitalityData({
    guestNeedsJson: JSON.stringify([{ code: "HOTEL", notes: "Four Seasons" }, { code: "LUNCH", notes: "" }]),
    qrCheckInRequired: false,
    oneTimeVisit: true,
  });
  assert.equal(fromCatalogue.hotelRequired, true);
  assert.equal(fromCatalogue.mealLunch, true);
  assert.equal(fromCatalogue.qrCheckInRequired, false);
  assert.equal(fromCatalogue.oneTimeVisit, true);
  assert.equal(hospitalityData({}).qrCheckInRequired, true);
  assert.equal(
    hospitalityData({ guestNeedsJson: JSON.stringify([{ code: "FROM_ABROAD", notes: "" }]) }).fromAbroad,
    true,
  );
  console.log("hospitality.check: ok");
}

check();
