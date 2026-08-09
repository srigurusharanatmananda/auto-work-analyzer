/**
 * The SSRF range check.
 *
 * Written as a list of addresses that must be refused rather than as a test of
 * the implementation's shape, because the thing worth pinning is coverage of
 * the bypass forms — every one of these is a real way people have reached a
 * metadata endpoint through a URL field.
 */

import { describe, expect, test } from "bun:test";
import { isBlockedAddress } from "./privateAddress.js";

describe("isBlockedAddress — IPv4", () => {
  test("blocks loopback across the whole /8, not just 127.0.0.1", () => {
    for (const address of ["127.0.0.1", "127.0.0.2", "127.1.2.3", "127.255.255.254"]) {
      expect(isBlockedAddress(address)).toBe(true);
    }
  });

  test("blocks the cloud metadata endpoint", () => {
    expect(isBlockedAddress("169.254.169.254")).toBe(true);
  });

  test("blocks the RFC1918 ranges at both edges", () => {
    for (const address of [
      "10.0.0.0",
      "10.255.255.255",
      "172.16.0.0",
      "172.31.255.255",
      "192.168.0.0",
      "192.168.255.255",
    ]) {
      expect(isBlockedAddress(address)).toBe(true);
    }
  });

  /**
   * The /12 is where a regex gets it wrong in both directions: `172.` blocks
   * public space, and `172.16.` misses most of the range.
   */
  test("gets the boundaries of 172.16.0.0/12 exactly right", () => {
    expect(isBlockedAddress("172.15.255.255")).toBe(false);
    expect(isBlockedAddress("172.16.0.0")).toBe(true);
    expect(isBlockedAddress("172.31.255.255")).toBe(true);
    expect(isBlockedAddress("172.32.0.0")).toBe(false);
  });

  test("gets the boundaries of the CGNAT /10 right", () => {
    expect(isBlockedAddress("100.63.255.255")).toBe(false);
    expect(isBlockedAddress("100.64.0.0")).toBe(true);
    expect(isBlockedAddress("100.127.255.255")).toBe(true);
    expect(isBlockedAddress("100.128.0.0")).toBe(false);
  });

  test("blocks 0.0.0.0, which reaches every local interface", () => {
    expect(isBlockedAddress("0.0.0.0")).toBe(true);
  });

  test("blocks multicast, reserved and broadcast", () => {
    for (const address of ["224.0.0.1", "239.255.255.255", "240.0.0.1", "255.255.255.255"]) {
      expect(isBlockedAddress(address)).toBe(true);
    }
  });

  test("allows ordinary public addresses", () => {
    for (const address of ["8.8.8.8", "1.1.1.1", "142.250.185.78", "172.217.0.1", "99.84.0.1"]) {
      expect(isBlockedAddress(address)).toBe(false);
    }
  });
});

describe("isBlockedAddress — IPv6", () => {
  test("blocks loopback and unspecified", () => {
    expect(isBlockedAddress("::1")).toBe(true);
    expect(isBlockedAddress("::")).toBe(true);
  });

  test("blocks unique-local, link-local and multicast", () => {
    for (const address of ["fc00::1", "fd12:3456::1", "fe80::1", "ff02::1"]) {
      expect(isBlockedAddress(address)).toBe(true);
    }
  });

  /** The reason this file exists: v6 spellings of a v4 address. */
  test("blocks IPv4-mapped loopback in both spellings", () => {
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:7f00:1")).toBe(true);
  });

  test("blocks the metadata endpoint wrapped as IPv4-mapped", () => {
    expect(isBlockedAddress("::ffff:169.254.169.254")).toBe(true);
  });

  /**
   * The form the first version of this guard missed. `::a.b.c.d` has no ffff
   * marker, so the IPv4-mapped test above does not see it — and a review found
   * `::169.254.169.254` classified as a public address. Deprecated is not the
   * same as unroutable; the resolver and the socket both still honour it.
   */
  test("blocks IPv4-compatible addresses, which carry no ffff marker", () => {
    expect(isBlockedAddress("::169.254.169.254")).toBe(true);
    expect(isBlockedAddress("::127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::10.0.0.1")).toBe(true);
  });

  /** `::` and `::1` are the unspecified/loopback case, not embedded v4. */
  test("still blocks the bare unspecified and loopback addresses", () => {
    expect(isBlockedAddress("::")).toBe(true);
    expect(isBlockedAddress("::1")).toBe(true);
  });

  test("blocks NAT64 and 6to4 wrappers around a private address", () => {
    expect(isBlockedAddress("64:ff9b::169.254.169.254")).toBe(true);
    expect(isBlockedAddress("2002:a00:1::1")).toBe(true); // 6to4 over 10.0.0.1
  });

  test("allows a public IPv6 address, including one mapped from public IPv4", () => {
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
    expect(isBlockedAddress("::ffff:8.8.8.8")).toBe(false);
    expect(isBlockedAddress("2002:808:808::1")).toBe(false); // 6to4 over 8.8.8.8
  });
});

describe("isBlockedAddress — anything it cannot classify", () => {
  /**
   * Blocked, not allowed. An address the checker does not understand is one it
   * cannot vouch for, and the two failure modes are not symmetric: a wrongly
   * refused recording is an error message, a wrongly allowed one is a
   * credential leak.
   */
  test("treats unparseable input as blocked", () => {
    for (const value of ["", "not-an-address", "example.com", "999.1.1.1", "::gggg", "1.2.3"]) {
      expect(isBlockedAddress(value)).toBe(true);
    }
  });
});
