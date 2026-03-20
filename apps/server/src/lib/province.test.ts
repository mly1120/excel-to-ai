import assert from "node:assert/strict";
import test from "node:test";

import { extractProvince } from "./province";

test("extractProvince extracts province from municipality and province addresses", () => {
  assert.equal(extractProvince("\u5317\u4eac\u5e02\u6d77\u6dc0\u533a\u4e2d\u5173\u6751"), "\u5317\u4eac\u5e02");
  assert.equal(
    extractProvince("\u5e7f\u4e1c\u7701\u6df1\u5733\u5e02\u5357\u5c71\u533a\u79d1\u6280\u56ed"),
    "\u5e7f\u4e1c\u7701"
  );
});

test("extractProvince returns empty string when no province is present", () => {
  assert.equal(extractProvince("No province here"), "");
});
