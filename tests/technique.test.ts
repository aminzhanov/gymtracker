import { test } from "node:test";
import assert from "node:assert/strict";
import { driveVideoLink, normalizeTechniqueVideos } from "../src/technique.ts";

const fileId = "1DemoVideo_file-1234567890";
test("Drive share and preview links normalize to a safe embedded player and retain resource keys", () => {
  const expected = {
    fileId,
    resourceKey: "0-Resource_Key",
    url: `https://drive.google.com/file/d/${fileId}/view?resourcekey=0-Resource_Key`,
    embedUrl: `https://drive.google.com/file/d/${fileId}/preview?resourcekey=0-Resource_Key`,
  };
  for (const link of [
    `https://drive.google.com/file/d/${fileId}/view?usp=sharing&resourcekey=0-Resource_Key`,
    `https://drive.google.com/file/d/${fileId}/preview?resourcekey=0-Resource_Key`,
    `https://drive.google.com/open?id=${fileId}&resourcekey=0-Resource_Key`,
    `https://drive.google.com/uc?id=${fileId}&resourcekey=0-Resource_Key`,
  ])
    assert.deepEqual(driveVideoLink(`  ${link}  `), expected);
  assert.equal(
    driveVideoLink(`https://drive.google.com/file/d/${fileId}/view`)
      .resourceKey,
    "",
  );
  assert.deepEqual(normalizeTechniqueVideos({ bench: expected.url }), {
    bench: expected.url,
  });
});
test("technique embeds reject arbitrary hosts, scripts, credentials, folders and malformed identifiers", () => {
  for (const link of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    `https://drive.google.com.attacker.test/file/d/${fileId}/view`,
    `https://attacker.test/?url=https://drive.google.com/file/d/${fileId}/view`,
    `https://user:password@drive.google.com/file/d/${fileId}/view`,
    `http://drive.google.com/file/d/${fileId}/view`,
    `https://drive.google.com:444/file/d/${fileId}/view`,
    `https://drive.google.com/drive/folders/${fileId}`,
    "https://drive.google.com/file/d/short/view",
    `https://drive.google.com/file/d/${fileId}/view?resourcekey=bad%26key`,
    "https://drive.google.com/file/d/%3Cscript%3E/view",
    "",
    "x".repeat(2001),
  ])
    assert.throws(() => driveVideoLink(link), /Google Drive/);
  for (const value of [
    null,
    [],
    { bench: 42 },
    { bench: "https://attacker.test" },
  ])
    assert.throws(() => normalizeTechniqueVideos(value));
});
