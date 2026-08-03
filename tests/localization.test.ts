import assert from "node:assert/strict";
import test from "node:test";

import { localeFromAcceptLanguage } from "../src/lib/i18n/config";
import { en, it, translate, type Messages } from "../src/lib/i18n/messages";

test("English and Italian dictionaries have identical non-empty keys", () => {
  assert.deepEqual(Object.keys(it).sort(), Object.keys(en).sort());
  for (const [key, value] of Object.entries(en)) {
    assert.ok(value.trim(), `English translation ${key} is empty`);
    assert.ok(
      it[key as keyof Messages].trim(),
      `Italian translation ${key} is empty`,
    );
  }
});

test("translations interpolate values and fall back to English", () => {
  assert.equal(
    translate(it, "home.discoverAt", { organization: "Politecnico di Milano" }),
    "Scopri i corsi di Politecnico di Milano",
  );
  const incomplete: Messages = { ...it, "nav.discover": "" };
  assert.equal(translate(incomplete, "nav.discover"), "Discover");
});

test("Accept-Language detection supports region tags and preference order", () => {
  assert.equal(localeFromAcceptLanguage("it-IT,it;q=0.9,en;q=0.8"), "it");
  assert.equal(localeFromAcceptLanguage("fr-FR, en-GB;q=0.8"), "en");
  assert.equal(localeFromAcceptLanguage("fr-FR,de;q=0.8"), null);
  assert.equal(localeFromAcceptLanguage(null), null);
});
