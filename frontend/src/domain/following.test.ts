import { describe, expect, it } from "vitest";
import { makeFeed } from "./feed";
import { followedChannels, subscribedChannels } from "./following";
import type { Video } from "./types";

const video = (channel: string) => ({ channel }) as Video;

describe("subscribedChannels", () => {
  it("lists each channel in your own catalog once, in catalog order", () => {
    expect(subscribedChannels([video("B"), video("A"), video("B")])).toEqual(["B", "A"]);
  });
});

describe("followedChannels", () => {
  const subs = makeFeed({ name: "Subscriptions", kind: "subs", channels: ["Hand", "A"] });

  it("is Subscriptions' channels plus the ones you subscribe to, each once", () => {
    expect(followedChannels([makeFeed(), subs], ["A", "YouTube"])).toEqual(["Hand", "A", "YouTube"]);
  });

  it("is just the subscribed channels when there's no Subscriptions feed", () => {
    expect(followedChannels([makeFeed()], ["A"])).toEqual(["A"]);
  });
});
