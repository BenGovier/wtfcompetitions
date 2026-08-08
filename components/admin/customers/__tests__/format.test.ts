import { describe, it, expect } from "vitest"
import {
  resolveCustomerName,
  resolveSecondaryHandle,
  isLikelyHandleNoise,
  formatUkMobile,
} from "../format"

describe("resolveCustomerName", () => {
  it("prefers first + last name above everything", () => {
    expect(
      resolveCustomerName({
        first_name: "Ada",
        last_name: "Lovelace",
        display_name: "ada_l",
        real_name: "adalove88",
        email: "ada@x.io",
      }),
    ).toBe("Ada Lovelace")
  })

  it("falls back to first name only, then last name only", () => {
    expect(resolveCustomerName({ first_name: "Ada" })).toBe("Ada")
    expect(resolveCustomerName({ last_name: "Lovelace" })).toBe("Lovelace")
  })

  it("uses display_name before real_name", () => {
    expect(resolveCustomerName({ display_name: "Ada L", real_name: "adalove88" })).toBe("Ada L")
  })

  it("uses real_name before the email local-part", () => {
    expect(resolveCustomerName({ real_name: "adalove88", email: "ada@x.io" })).toBe("adalove88")
  })

  it("uses the email local-part when no name exists", () => {
    expect(resolveCustomerName({ email: "ada@x.io" })).toBe("ada")
  })

  it("returns 'Unknown customer' when nothing is available", () => {
    expect(resolveCustomerName({})).toBe("Unknown customer")
    expect(resolveCustomerName({ first_name: "  ", email: "  " })).toBe("Unknown customer")
  })

  it("trims whitespace on supplied names", () => {
    expect(resolveCustomerName({ first_name: "  Ada  ", last_name: " Lovelace " })).toBe("Ada Lovelace")
  })
})

describe("isLikelyHandleNoise", () => {
  it("flags username-style handles with digits", () => {
    expect(isLikelyHandleNoise("elliemaythom2709")).toBe(true)
    expect(isLikelyHandleNoise("kyemakd9")).toBe(true)
  })

  it("flags long single lowercase tokens", () => {
    expect(isLikelyHandleNoise("absfactor")).toBe(true)
  })

  it("flags emails and empties", () => {
    expect(isLikelyHandleNoise("ada@x.io")).toBe(true)
    expect(isLikelyHandleNoise("")).toBe(true)
    expect(isLikelyHandleNoise(null)).toBe(true)
  })

  it("does NOT flag real multi-word names", () => {
    expect(isLikelyHandleNoise("Ada Lovelace")).toBe(false)
    expect(isLikelyHandleNoise("Jane")).toBe(false)
  })
})

describe("resolveSecondaryHandle", () => {
  it("returns a non-noise handle that differs from the primary", () => {
    expect(resolveSecondaryHandle({ display_name: "The Ace" }, "Ada Lovelace")).toBe("The Ace")
  })

  it("omits the handle when it is noise", () => {
    expect(resolveSecondaryHandle({ real_name: "adalove88" }, "Ada Lovelace")).toBeNull()
  })

  it("omits the handle when it equals the primary name", () => {
    expect(resolveSecondaryHandle({ display_name: "Ada Lovelace" }, "Ada Lovelace")).toBeNull()
  })

  it("returns null when there is no candidate", () => {
    expect(resolveSecondaryHandle({}, "Ada")).toBeNull()
  })
})

describe("formatUkMobile", () => {
  it("groups a standard 11-digit UK mobile", () => {
    expect(formatUkMobile("07786144708")).toBe("07786 144708")
  })

  it("strips embedded spaces before grouping", () => {
    expect(formatUkMobile("07786 144 708")).toBe("07786 144708")
  })

  it("leaves non-UK / unusual numbers unchanged", () => {
    expect(formatUkMobile("+447786144708")).toBe("+447786144708")
    expect(formatUkMobile("1234")).toBe("1234")
  })

  it("returns an empty string for empty input", () => {
    expect(formatUkMobile(null)).toBe("")
    expect(formatUkMobile("   ")).toBe("")
  })
})
