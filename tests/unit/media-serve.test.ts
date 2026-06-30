import { describe, it, expect } from "vitest";

import { getProductImage, isRehosted, PLACEHOLDER_IMAGE } from "@/lib/media/serve";

describe("getProductImage", () => {
  it("prefers the rehosted URL", () => {
    expect(
      getProductImage({ image_rehosted_url: "https://cdn/x.webp", image_url: "https://ext/y.jpg" })
    ).toBe("https://cdn/x.webp");
  });

  it("falls back to the original URL", () => {
    expect(getProductImage({ image_rehosted_url: null, image_url: "https://ext/y.jpg" })).toBe(
      "https://ext/y.jpg"
    );
  });

  it("falls back to the placeholder when nothing is set", () => {
    expect(getProductImage({ image_rehosted_url: null, image_url: null })).toBe(PLACEHOLDER_IMAGE);
    expect(getProductImage(null)).toBe(PLACEHOLDER_IMAGE);
    expect(getProductImage(undefined)).toBe(PLACEHOLDER_IMAGE);
  });

  it("isRehosted reflects whether a rehosted URL exists", () => {
    expect(isRehosted({ image_rehosted_url: "https://cdn/x.webp" })).toBe(true);
    expect(isRehosted({ image_url: "https://ext/y.jpg" })).toBe(false);
    expect(isRehosted(null)).toBe(false);
  });
});
